/**
 * Authentication + role-based access for the Mediconny POS.
 *
 * Roles (stored in staff_users.role, matching schema.sql):
 *   Admin            – full access, staff management, settings, backups
 *   Clinician        – doctor / nurse: patients + appointments, read-only inventory
 *   Pharmacist/Shop  – shop cashier: POS sales, read-only inventory / patients / appointments
 *
 * Passwords are hashed with scrypt; sessions are random tokens held in memory
 * and sent as an HttpOnly, SameSite=Strict cookie.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROLES = ["Admin", "Clinician", "Pharmacist/Shop"];
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // idle timeout
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
const COOKIE = "mc_session";

/* ---------------- password hashing ---------------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString("hex"));

function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 128) return "Password is too long.";
  return null;
}

/* ---------------- staff repositories ---------------- */
function sqliteRepo(db) {
  // Migrate older databases created before password columns existed.
  const cols = db.prepare("PRAGMA table_info(staff_users)").all().map(c => c.name);
  if (!cols.includes("password_hash")) db.exec("ALTER TABLE staff_users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
  if (!cols.includes("must_change")) db.exec("ALTER TABLE staff_users ADD COLUMN must_change INTEGER NOT NULL DEFAULT 0");
  const map = r => ({
    id: r.id, username: r.username, fullName: r.full_name, role: r.role,
    active: !!r.active, passwordHash: r.password_hash || "", mustChange: !!r.must_change, createdAt: r.created_at
  });
  return {
    all: () => db.prepare("SELECT * FROM staff_users ORDER BY created_at, rowid").all().map(map),
    insert: u => db.prepare(`INSERT INTO staff_users (id, username, full_name, role, active, password_hash, must_change)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`).run(u.id, u.username, u.fullName, u.role, u.active ? 1 : 0, u.passwordHash, u.mustChange ? 1 : 0),
    update: u => db.prepare(`UPDATE staff_users SET full_name = ?, role = ?, active = ?, password_hash = ?, must_change = ? WHERE id = ?`)
      .run(u.fullName, u.role, u.active ? 1 : 0, u.passwordHash, u.mustChange ? 1 : 0, u.id),
    remove: id => db.prepare("DELETE FROM staff_users WHERE id = ?").run(id)
  };
}

function jsonRepo(file) {
  const load = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; } };
  const save = list => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, file);
  };
  return {
    all: () => load(),
    insert: u => save([...load(), { ...u, createdAt: new Date().toISOString() }]),
    update: u => save(load().map(x => (x.id === u.id ? { ...x, ...u } : x))),
    remove: id => save(load().filter(x => x.id !== id))
  };
}

/* ---------------- auth service ---------------- */
function create({ sqliteDb, dataDir }) {
  const repo = sqliteDb ? sqliteRepo(sqliteDb) : jsonRepo(path.join(dataDir, "staff.json"));
  const sessions = new Map(); // token -> { userId, expires }
  const attempts = new Map(); // "ip|user" -> { count, until }

  const publicUser = u => ({ id: u.id, username: u.username, fullName: u.fullName, role: u.role, active: u.active, mustChange: u.mustChange });
  const findByName = name => repo.all().find(u => u.username === String(name || "").trim().toLowerCase());
  const findById = id => repo.all().find(u => u.id === id);
  const activeAdmins = () => repo.all().filter(u => u.role === "Admin" && u.active);

  function dropSessions(userId) {
    for (const [t, s] of sessions) if (s.userId === userId) sessions.delete(t);
  }

  function parseCookies(req) {
    const out = {};
    for (const part of String(req.headers.cookie || "").split(";")) {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function tokenOf(req) {
    return parseCookies(req)[COOKIE] || "";
  }

  function authenticate(req) {
    const token = tokenOf(req);
    const s = token && sessions.get(token);
    if (!s) return null;
    if (s.expires < Date.now()) { sessions.delete(token); return null; }
    const user = findById(s.userId);
    if (!user || !user.active) { sessions.delete(token); return null; }
    s.expires = Date.now() + SESSION_TTL_MS;
    return user;
  }

  function cookieHeader(token, secure, maxAgeSec) {
    return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
  }

  function login(username, password, ip) {
    const key = `${ip}|${String(username || "").toLowerCase()}`;
    const a = attempts.get(key);
    if (a && a.until > Date.now()) {
      return { error: "Too many failed attempts. Try again in a few minutes.", status: 429 };
    }
    const user = findByName(username);
    const ok = verifyPassword(String(password || ""), user ? user.passwordHash : DUMMY_HASH) && user && user.active;
    if (!ok) {
      const expired = a && a.until > 0 && a.until <= Date.now();
      const next = { count: (a && !expired ? a.count : 0) + 1, until: 0 };
      if (next.count >= MAX_FAILS) { next.until = Date.now() + LOCK_MS; next.count = 0; }
      attempts.set(key, next);
      return { error: "Invalid username or password.", status: 401 };
    }
    attempts.delete(key);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_TTL_MS });
    return { token, user: publicUser(user) };
  }

  function logout(req) {
    sessions.delete(tokenOf(req));
  }

  function listStaff() {
    return repo.all().map(publicUser);
  }

  function createStaff({ username, fullName, role, password }) {
    const uname = String(username || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(uname)) return { error: "Username must be 3-32 characters: letters, numbers, . _ -" };
    if (!String(fullName || "").trim()) return { error: "Full name is required." };
    if (!ROLES.includes(role)) return { error: "Invalid role." };
    const pwErr = validatePassword(password);
    if (pwErr) return { error: pwErr };
    if (findByName(uname)) return { error: "Username already exists.", status: 409 };
    const u = {
      id: "USR-" + crypto.randomBytes(6).toString("hex"), username: uname, fullName: String(fullName).trim(),
      role, active: true, passwordHash: hashPassword(password), mustChange: true
    };
    repo.insert(u);
    return { user: publicUser(u) };
  }

  function updateStaff(id, body, actingUserId) {
    const u = findById(id);
    if (!u) return { error: "User not found.", status: 404 };
    const next = { ...u };
    if (body.fullName !== undefined) {
      if (!String(body.fullName).trim()) return { error: "Full name is required." };
      next.fullName = String(body.fullName).trim();
    }
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) return { error: "Invalid role." };
      next.role = body.role;
    }
    if (body.active !== undefined) next.active = !!body.active;
    if (body.password) {
      const pwErr = validatePassword(body.password);
      if (pwErr) return { error: pwErr };
      next.passwordHash = hashPassword(body.password);
      next.mustChange = true;
    }
    const losesAdmin = u.role === "Admin" && u.active && (next.role !== "Admin" || !next.active);
    if (losesAdmin && activeAdmins().length <= 1) return { error: "At least one active Admin is required." };
    if (id === actingUserId && (next.role !== u.role || !next.active)) {
      return { error: "You cannot change your own role or deactivate yourself." };
    }
    repo.update(next);
    if (body.password || !next.active || next.role !== u.role) dropSessions(id);
    return { user: publicUser(next) };
  }

  function deleteStaff(id, actingUserId) {
    const u = findById(id);
    if (!u) return { error: "User not found.", status: 404 };
    if (id === actingUserId) return { error: "You cannot delete your own account." };
    if (u.role === "Admin" && u.active && activeAdmins().length <= 1) return { error: "At least one active Admin is required." };
    repo.remove(id);
    dropSessions(id);
    return { ok: true };
  }

  function changeOwnPassword(user, current, next) {
    if (!verifyPassword(String(current || ""), user.passwordHash)) return { error: "Current password is incorrect.", status: 403 };
    const pwErr = validatePassword(next);
    if (pwErr) return { error: pwErr };
    if (next === current) return { error: "New password must differ from the current one." };
    repo.update({ ...user, passwordHash: hashPassword(next), mustChange: false });
    return { ok: true };
  }

  /** Create the first admin when no staff exist. Returns the generated password (or null). */
  function bootstrap() {
    if (repo.all().length > 0) return null;
    const generated = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    repo.insert({
      id: "USR-" + crypto.randomBytes(6).toString("hex"), username: "admin", fullName: "Clinic Administrator",
      role: "Admin", active: true, passwordHash: hashPassword(password), mustChange: true
    });
    return { username: "admin", password, generated };
  }

  return {
    authenticate, login, logout, cookieHeader, listStaff, createStaff, updateStaff, deleteStaff,
    changeOwnPassword, bootstrap, publicUser, COOKIE
  };
}

module.exports = { create, ROLES };
