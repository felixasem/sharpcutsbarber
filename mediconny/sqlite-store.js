/**
 * SQLite persistence layer driven by schema.sql.
 * Uses better-sqlite3 if installed, otherwise Node's built-in node:sqlite (Node 22.5+).
 * Exposes the same state shape the REST handlers use, mapped to/from the relational tables.
 * Returns null from open() if no SQLite engine is available.
 */
const fs = require("fs");

const PAYMENT_METHODS = ["Cash", "Mobile Money (MoMo)", "Card / POS Terminal", "Bank Transfer", "Clinic Account"];
const APPT_STATUSES = ["Scheduled", "Checked In", "Completed", "Cancelled", "No-Show"];
const num = v => Number(v) || 0;

function open(dbPath, schemaPath, defaults) {
  let db;
  let engine;
  try {
    const Better = require("better-sqlite3");
    db = new Better(dbPath);
    engine = "sqlite (better-sqlite3)";
  } catch (e) {
    try {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath);
      engine = "sqlite (node:sqlite)";
    } catch (e2) {
      return null;
    }
  }
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  function read() {
    const s = db.prepare("SELECT * FROM clinic_settings WHERE id = 1").get() || {};
    const payBySale = {};
    for (const p of db.prepare("SELECT * FROM sale_payments ORDER BY id").all()) {
      (payBySale[p.sale_id] = payBySale[p.sale_id] || []).push({
        method: p.payment_method, amount: p.amount, ref: p.reference_note || ""
      });
    }
    const itemsBySale = {};
    for (const i of db.prepare("SELECT * FROM sale_items ORDER BY id").all()) {
      (itemsBySale[i.sale_id] = itemsBySale[i.sale_id] || []).push({
        productId: i.product_id || "", sku: i.sku, name: i.product_name, price: i.unit_price, qty: i.quantity
      });
    }
    return {
      currency: s.currency || defaults.currency,
      settings: {
        clinicName: s.clinic_name || defaults.settings.clinicName,
        address: s.address || "",
        phone: s.phone || "",
        taxId: s.tax_id || "",
        receiptFooter: s.receipt_footer || defaults.settings.receiptFooter
      },
      inventory: db.prepare("SELECT * FROM inventory ORDER BY rowid").all().map(r => ({
        id: r.id, sku: r.sku, name: r.product_name, category: r.category, formType: r.form_type || "",
        cost: r.unit_cost, price: r.selling_price, stock: r.stock_qty, reorder: r.reorder_level,
        batch: r.batch_number || "", expiry: r.expiry_date || ""
      })),
      patients: db.prepare("SELECT * FROM patients ORDER BY rowid").all().map(r => ({
        id: r.id, code: r.patient_code, name: r.full_name, phone: r.phone, email: r.email || "",
        dob: r.dob || "", gender: r.gender || "", allergies: r.allergies || "", notes: r.medical_notes || ""
      })),
      appointments: db.prepare("SELECT * FROM appointments ORDER BY appointment_date, appointment_time").all().map(r => ({
        id: r.id, patientId: r.patient_id, patientName: r.patient_name, date: r.appointment_date,
        time: r.appointment_time, type: r.visit_type, consultationFee: r.consultation_fee,
        clinician: r.clinician, status: r.status, notes: r.clinical_notes || ""
      })),
      sales: db.prepare("SELECT * FROM sales ORDER BY sale_timestamp DESC, rowid DESC").all().map(r => ({
        id: r.id, receiptNo: r.receipt_no, timestamp: r.sale_timestamp,
        patientId: r.patient_id || "", patientName: r.patient_name, appointmentId: r.appointment_id || "",
        items: itemsBySale[r.id] || [], subtotal: r.products_subtotal,
        consultationType: r.consultation_type || "", consultationFee: r.consultation_fee,
        discount: r.discount_amount, tax: r.tax_amount, total: r.total_due,
        payments: payBySale[r.id] || [], totalPaid: r.total_paid, changeDue: r.change_due,
        paymentMethod: r.payment_summary, note: r.sale_note || "", cashier: r.cashier_name || ""
      }))
    };
  }

  function write(state) {
    db.exec("BEGIN");
    try {
      for (const t of ["sale_payments", "sale_items", "sales", "appointments", "inventory", "patients", "clinic_settings"]) {
        db.exec(`DELETE FROM ${t}`);
      }
      db.prepare(`INSERT INTO clinic_settings (id, clinic_name, currency, address, phone, tax_id, receipt_footer)
                  VALUES (1, ?, ?, ?, ?, ?, ?)`).run(
        state.settings.clinicName, state.currency || "GHC", state.settings.address || "",
        state.settings.phone || "", state.settings.taxId || "", state.settings.receiptFooter);

      const insPt = db.prepare(`INSERT INTO patients (id, patient_code, full_name, phone, email, dob, gender, allergies, medical_notes)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const ptIds = new Set();
      for (const p of state.patients) {
        insPt.run(p.id, p.code, p.name, p.phone || "", p.email || "", p.dob || "", p.gender || "", p.allergies || "", p.notes || "");
        ptIds.add(p.id);
      }

      const insInv = db.prepare(`INSERT INTO inventory (id, sku, product_name, category, form_type, unit_cost, selling_price, stock_qty, reorder_level, batch_number, expiry_date)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const invIds = new Set();
      for (const i of state.inventory) {
        insInv.run(i.id, i.sku, i.name, i.category || "Vitamins", i.formType || "",
          Math.max(0, num(i.cost)), Math.max(0, num(i.price)), Math.max(0, Math.trunc(num(i.stock))),
          Math.max(0, Math.trunc(num(i.reorder))), i.batch || "", i.expiry || "");
        invIds.add(i.id);
      }

      const insAppt = db.prepare(`INSERT INTO appointments (id, patient_id, patient_name, appointment_date, appointment_time, visit_type, consultation_fee, clinician, status, clinical_notes)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const apptIds = new Set();
      for (const a of state.appointments) {
        if (!ptIds.has(a.patientId)) continue; // mirrors ON DELETE CASCADE
        insAppt.run(a.id, a.patientId, a.patientName || "", a.date, a.time, a.type || "General Clinic Consultation",
          Math.max(0, num(a.consultationFee)), a.clinician || "Mediconny Clinic",
          APPT_STATUSES.includes(a.status) ? a.status : "Scheduled", a.notes || "");
        apptIds.add(a.id);
      }

      const insSale = db.prepare(`INSERT INTO sales (id, receipt_no, sale_timestamp, patient_id, patient_name, appointment_id, products_subtotal,
                                    consultation_type, consultation_fee, discount_amount, tax_rate, tax_amount, total_due, total_paid, change_due, payment_summary, sale_note, cashier_name)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`);
      const insItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, sku, product_name, unit_price, quantity, line_total)
                                  VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const insPay = db.prepare(`INSERT INTO sale_payments (sale_id, payment_method, amount, reference_note) VALUES (?, ?, ?, ?)`);
      for (const s of state.sales) {
        insSale.run(s.id, s.receiptNo, s.timestamp, ptIds.has(s.patientId) ? s.patientId : null,
          s.patientName || "Walk-In Customer", apptIds.has(s.appointmentId) ? s.appointmentId : null,
          num(s.subtotal), s.consultationType || "", num(s.consultationFee), num(s.discount),
          num(s.tax), num(s.total), num(s.totalPaid), num(s.changeDue), s.paymentMethod || "Cash", s.note || "", s.cashier || "Shop Desk");
        for (const l of s.items || []) {
          const qty = Math.trunc(num(l.qty));
          if (qty <= 0) continue;
          insItem.run(s.id, invIds.has(l.productId) ? l.productId : null, l.sku || "", l.name || "",
            Math.max(0, num(l.price)), qty, Math.max(0, num(l.price) * qty));
        }
        for (const p of s.payments || []) {
          if (num(p.amount) <= 0) continue;
          insPay.run(s.id, PAYMENT_METHODS.includes(p.method) ? p.method : "Cash", num(p.amount), p.ref || "");
        }
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  const isEmpty = !db.prepare("SELECT 1 FROM clinic_settings LIMIT 1").get();
  return { engine, read, write, isEmpty, db };
}

module.exports = { open };
