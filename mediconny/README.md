# Mediconny Clinic & Supplement Shop POS

```bash
node server.js          # http://localhost:3000  (PORT env var to change)
node seed.js --force    # optional demo data
```

## Sign-in & roles

On first start the server creates an `admin` account and prints a temporary
password in the console (or uses the `ADMIN_PASSWORD` env var). Every new or
reset account must change its temporary password at first sign-in.

| Role | Can do |
|---|---|
| **Admin** | Everything: inventory (incl. unit cost), settings, backups/restore, deletions, staff accounts |
| **Doctor / Nurse** (`Clinician`) | Patients (incl. medical notes) and appointments; view-only inventory; no sales or revenue |
| **Shop Cashier** (`Pharmacist/Shop`) | POS sales + receipts; view-only inventory, patients (no medical notes) and appointments |

Access is enforced on the server (`rolesFor` in `server.js`); the UI only hides
what a role cannot use. Passwords are scrypt-hashed, sessions are HttpOnly
SameSite=Strict cookies with an 8h idle timeout, and 5 failed sign-ins lock
that username+IP for 5 minutes. Serve over HTTPS in production.

Environment: `PORT`, `DATA_DIR` (database location), `ADMIN_PASSWORD` (first-run admin).
