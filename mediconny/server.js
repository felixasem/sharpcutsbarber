/**
 * Mediconny Clinic & Supplement Shop — Full-Stack Node.js Server
 * ----------------------------------------------------------------------------
 * Features:
 * - Serves the Mediconny WebApp frontend (`mediconny_clinic_webapp.html`)
 * - REST API endpoints for multi-device clinic & shop staff access:
 *     GET    /api/health          -> Server status & storage engine info
 *     GET    /api/state           -> Full clinic state (settings, inventory, patients, appointments, sales)
 *     PUT    /api/state           -> Bulk state restore / sync
 *     PUT    /api/settings        -> Update clinic receipt header (address, phone, tax ID, currency)
 *     POST   /api/inventory       -> Create or update a vitamin/supplement SKU
 *     PATCH  /api/inventory/:id   -> Adjust stock quantity
 *     DELETE /api/inventory/:id   -> Delete an inventory SKU
 *     POST   /api/patients        -> Register or update a patient profile
 *     DELETE /api/patients/:id    -> Delete a patient profile
 *     POST   /api/appointments    -> Schedule or update a clinic appointment
 *     DELETE /api/appointments/:id-> Delete an appointment
 *     POST   /api/sales           -> Complete a POS sale (supports Split Payments, Consultation Fee, & atomic stock deduction)
 *
 * Persistence:
 * - Automatically uses `better-sqlite3` with `schema.sql` if installed (`npm install`),
 *   and falls back seamlessly to an atomic JSON datastore (`./data/mediconny_db.json`)
 *   using native Node.js modules so it runs immediately with `node server.js`.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const JSON_DB_PATH = path.join(DATA_DIR, "mediconny_db.json");
const HTML_FILE_PATH = path.join(__dirname, "mediconny_clinic_webapp.html");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_STATE = {
  currency: "GHC",
  settings: {
    clinicName: "Mediconny Clinic & Supplement Shop",
    address: "",
    phone: "",
    taxId: "",
    receiptFooter: "Thank you for visiting Mediconny Clinic & Shop!"
  },
  inventory: [],
  patients: [],
  appointments: [],
  sales: []
};

function readJsonDatabase() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const raw = fs.readFileSync(JSON_DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      currency: parsed.currency || "GHC",
      settings: Object.assign({}, DEFAULT_STATE.settings, parsed.settings || {}),
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : []
    };
  } catch (err) {
    console.error("Database read error:", err);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function writeJsonDatabase(state) {
  const tmpPath = JSON_DB_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpPath, JSON_DB_PATH);
}

// SQLite (schema.sql) when an engine is available; otherwise the JSON datastore.
let store = null;
try {
  store = require("./sqlite-store").open(path.join(DATA_DIR, "mediconny.db"), path.join(__dirname, "schema.sql"), DEFAULT_STATE);
  if (store && store.isEmpty) store.write(fs.existsSync(JSON_DB_PATH) ? readJsonDatabase() : DEFAULT_STATE);
} catch (err) {
  console.error("SQLite init failed, using JSON datastore:", err.message);
  store = null;
}
const storageEngine = store ? store.engine : "json";

function readDatabase() {
  return store ? store.read() : readJsonDatabase();
}

function writeDatabase(state) {
  return store ? store.write(state) : writeJsonDatabase(state);
}

function nextSeq(prefix, existing, width) {
  const max = existing.reduce((m, v) => {
    const n = parseInt(String(v || "").replace(prefix, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return prefix + String(max + 1).padStart(width, "0");
}

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  try {
    // Serve WebApp Frontend on / or /mediconny_clinic_webapp.html
    if (req.method === "GET" && (pathname === "/" || pathname === "/index.html" || pathname === "/mediconny_clinic_webapp.html")) {
      if (fs.existsSync(HTML_FILE_PATH)) {
        const html = fs.readFileSync(HTML_FILE_PATH, "utf8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("mediconny_clinic_webapp.html not found in server directory.");
    }

    // Serve schema.sql download if requested
    if (req.method === "GET" && pathname === "/schema.sql") {
      const schemaPath = path.join(__dirname, "schema.sql");
      if (fs.existsSync(schemaPath)) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(fs.readFileSync(schemaPath, "utf8"));
      }
    }

    // Health Check
    if (req.method === "GET" && pathname === "/api/health") {
      return sendJSON(res, 200, {
        status: "ok",
        storage: storageEngine,
        service: "Mediconny Clinic & Supplement Shop Node.js Server",
        timestamp: new Date().toISOString()
      });
    }

    // GET Full State
    if (req.method === "GET" && pathname === "/api/state") {
      const db = readDatabase();
      return sendJSON(res, 200, db);
    }

    // PUT Full State (Restore Backup / Reset)
    if (req.method === "PUT" && pathname === "/api/state") {
      const body = await parseBody(req);
      const nextState = {
        currency: body.currency || "GHC",
        settings: Object.assign({}, DEFAULT_STATE.settings, body.settings || {}),
        inventory: Array.isArray(body.inventory) ? body.inventory : [],
        patients: Array.isArray(body.patients) ? body.patients : [],
        appointments: Array.isArray(body.appointments) ? body.appointments : [],
        sales: Array.isArray(body.sales) ? body.sales : []
      };
      writeDatabase(nextState);
      return sendJSON(res, 200, { status: "updated", state: nextState });
    }

    // PUT Clinic & Receipt Header Settings
    if (req.method === "PUT" && pathname === "/api/settings") {
      const body = await parseBody(req);
      const db = readDatabase();
      if (body.currency) db.currency = body.currency;
      if (body.settings) {
        db.settings = Object.assign({}, db.settings, body.settings);
      }
      writeDatabase(db);
      return sendJSON(res, 200, { status: "ok", currency: db.currency, settings: db.settings });
    }

    // POST Inventory Item (Create or Update)
    if (req.method === "POST" && pathname === "/api/inventory") {
      const item = await parseBody(req);
      if (!item.sku || !item.name) {
        return sendJSON(res, 400, { error: "SKU and product name are required." });
      }
      const db = readDatabase();
      const id = item.id || ("INV-" + Date.now());
      const record = {
        id,
        sku: String(item.sku).trim(),
        name: String(item.name).trim(),
        category: item.category || "Vitamins",
        formType: item.formType || "",
        cost: Number(item.cost) || 0,
        price: Number(item.price) || 0,
        stock: Number(item.stock) || 0,
        reorder: Number(item.reorder) || 5,
        batch: item.batch || "",
        expiry: item.expiry || ""
      };
      if (db.inventory.some(x => x.sku === String(item.sku).trim() && x.id !== id)) {
        return sendJSON(res, 409, { error: "SKU already exists: " + String(item.sku).trim() });
      }
      const existingIdx = db.inventory.findIndex(x => x.id === id);
      if (existingIdx !== -1) {
        db.inventory[existingIdx] = record;
      } else {
        db.inventory.push(record);
      }
      writeDatabase(db);
      return sendJSON(res, 200, { status: "ok", item: record });
    }

    // PATCH Inventory Stock
    if (req.method === "PATCH" && pathname.startsWith("/api/inventory/")) {
      const id = decodeURIComponent(pathname.replace("/api/inventory/", ""));
      const body = await parseBody(req);
      const db = readDatabase();
      const item = db.inventory.find(x => x.id === id);
      if (!item) return sendJSON(res, 404, { error: "Product not found." });
      if (body.stock !== undefined) {
        item.stock = Math.max(0, parseInt(body.stock, 10) || 0);
      }
      writeDatabase(db);
      return sendJSON(res, 200, { status: "ok", item });
    }

    // DELETE Inventory Item
    if (req.method === "DELETE" && pathname.startsWith("/api/inventory/")) {
      const id = decodeURIComponent(pathname.replace("/api/inventory/", ""));
      const db = readDatabase();
      db.inventory = db.inventory.filter(x => x.id !== id);
      writeDatabase(db);
      return sendJSON(res, 200, { status: "deleted", id });
    }

    // POST Patient Record (Create or Update)
    if (req.method === "POST" && pathname === "/api/patients") {
      const pt = await parseBody(req);
      if (!pt.name || !pt.phone) {
        return sendJSON(res, 400, { error: "Patient name and phone are required." });
      }
      const db = readDatabase();
      const id = pt.id || ("PT-" + Date.now());
      const existingIdx = db.patients.findIndex(x => x.id === id);
      const code = existingIdx !== -1
        ? db.patients[existingIdx].code
        : (pt.code && !db.patients.some(p => p.code === pt.code && p.id !== id) ? pt.code : nextSeq("MC-PT-", db.patients.map(p => p.code), 3));

      const record = {
        id,
        code,
        name: String(pt.name).trim(),
        phone: String(pt.phone).trim(),
        email: pt.email || "",
        dob: pt.dob || "",
        gender: pt.gender || "",
        allergies: pt.allergies || "",
        notes: pt.notes || ""
      };

      if (existingIdx !== -1) {
        db.patients[existingIdx] = record;
      } else {
        db.patients.push(record);
      }
      writeDatabase(db);
      return sendJSON(res, 200, { status: "ok", patient: record });
    }

    // DELETE Patient Record
    if (req.method === "DELETE" && pathname.startsWith("/api/patients/")) {
      const id = decodeURIComponent(pathname.replace("/api/patients/", ""));
      const db = readDatabase();
      db.patients = db.patients.filter(x => x.id !== id);
      writeDatabase(db);
      return sendJSON(res, 200, { status: "deleted", id });
    }

    // POST Appointment (Create or Update)
    if (req.method === "POST" && pathname === "/api/appointments") {
      const appt = await parseBody(req);
      if (!appt.patientId || !appt.date || !appt.time) {
        return sendJSON(res, 400, { error: "Patient, date, and time are required." });
      }
      const db = readDatabase();
      const id = appt.id || ("APPT-" + Date.now());
      const pt = db.patients.find(p => p.id === appt.patientId);
      const record = {
        id,
        patientId: appt.patientId,
        patientName: pt ? `${pt.name} (${pt.code})` : (appt.patientName || "Registered Patient"),
        date: appt.date,
        time: appt.time,
        type: appt.type || "General Clinic Consultation",
        consultationFee: Number(appt.consultationFee) || 0,
        clinician: appt.clinician || "Mediconny Clinic",
        status: appt.status || "Scheduled",
        notes: appt.notes || ""
      };
      const existingIdx = db.appointments.findIndex(x => x.id === id);
      if (existingIdx !== -1) {
        db.appointments[existingIdx] = record;
      } else {
        db.appointments.push(record);
      }
      db.appointments.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      writeDatabase(db);
      return sendJSON(res, 200, { status: "ok", appointment: record });
    }

    // DELETE Appointment
    if (req.method === "DELETE" && pathname.startsWith("/api/appointments/")) {
      const id = decodeURIComponent(pathname.replace("/api/appointments/", ""));
      const db = readDatabase();
      db.appointments = db.appointments.filter(x => x.id !== id);
      writeDatabase(db);
      return sendJSON(res, 200, { status: "deleted", id });
    }

    // POST POS Sale (Atomic Stock Deduction + Consultation Fee + Split Payments)
    if (req.method === "POST" && pathname === "/api/sales") {
      const saleReq = await parseBody(req);
      const db = readDatabase();
      const items = Array.isArray(saleReq.items) ? saleReq.items : [];
      const consultFee = Number(saleReq.consultationFee) || 0;

      if (items.length === 0 && consultFee <= 0) {
        return sendJSON(res, 400, { error: "Sale must include at least one product or consultation fee." });
      }

      // Validate stock availability
      for (const line of items) {
        const prod = db.inventory.find(i => i.id === line.productId);
        if (!prod || Number(prod.stock) < Number(line.qty)) {
          return sendJSON(res, 400, { error: `Insufficient stock for ${line.name || line.sku}.` });
        }
      }

      // Deduct stock atomically
      items.forEach(line => {
        const prod = db.inventory.find(i => i.id === line.productId);
        if (prod) {
          prod.stock = Math.max(0, Number(prod.stock) - Number(line.qty));
        }
      });

      const saleRecord = {
        id: saleReq.id || ("SALE-" + Date.now()),
        receiptNo: (saleReq.receiptNo && !db.sales.some(x => x.receiptNo === saleReq.receiptNo) ? saleReq.receiptNo : nextSeq("MC-RCP-", db.sales.map(x => x.receiptNo), 4)),
        timestamp: saleReq.timestamp || new Date().toISOString(),
        patientId: saleReq.patientId || "",
        patientName: saleReq.patientName || "Walk-In Customer",
        appointmentId: saleReq.appointmentId || "",
        items,
        subtotal: Number(saleReq.subtotal) || 0,
        consultationType: saleReq.consultationType || "",
        consultationFee: consultFee,
        discount: Number(saleReq.discount) || 0,
        tax: Number(saleReq.tax) || 0,
        total: Number(saleReq.total) || 0,
        payments: Array.isArray(saleReq.payments) ? saleReq.payments : [],
        totalPaid: Number(saleReq.totalPaid) || Number(saleReq.total) || 0,
        changeDue: Number(saleReq.changeDue) || 0,
        paymentMethod: saleReq.paymentMethod || "Cash",
        note: saleReq.note || ""
      };

      // If linked to an appointment, mark appointment Completed
      if (saleRecord.appointmentId) {
        const appt = db.appointments.find(a => a.id === saleRecord.appointmentId);
        if (appt && appt.status !== "Completed") {
          appt.status = "Completed";
        }
      }

      db.sales.unshift(saleRecord);
      writeDatabase(db);
      return sendJSON(res, 201, { status: "ok", sale: saleRecord });
    }

    return sendJSON(res, 404, { error: "Endpoint not found" });
  } catch (err) {
    console.error("Server error:", err);
    return sendJSON(res, 500, { error: err.message || "Internal server error" });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`============================================================`);
    console.log(`Mediconny Clinic & Supplement Shop Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log(`============================================================`);
  });
}

module.exports = server;
