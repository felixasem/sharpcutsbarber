/**
 * Loads dummy demo data into every table (settings, inventory, patients,
 * appointments, sales + line items + split payments).
 * Usage: node seed.js          (refuses if data already exists)
 *        node seed.js --force  (replaces everything)
 */
const fs = require("fs");
const path = require("path");
const store = require("./sqlite-store").open(
  path.join(__dirname, "data", "mediconny.db"),
  path.join(__dirname, "schema.sql"),
  { currency: "GHC", settings: { clinicName: "Mediconny Clinic & Supplement Shop", receiptFooter: "Thank you for visiting Mediconny Clinic & Shop!" } }
);
if (!store) { console.error("No SQLite engine available (need Node 22.5+ or better-sqlite3)."); process.exit(1); }

const existing = store.read();
const hasData = existing.inventory.length || existing.patients.length || existing.sales.length;
if (hasData && !process.argv.includes("--force")) {
  console.log("Database already has data. Use --force to replace it.");
  process.exit(0);
}

const day = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const at = (off, h, m) => { const d = new Date(); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d.toISOString(); };

const inventory = [
  ["MC-VITC-1000", "Vitamin C 1000mg + Zinc", "Vitamins", "60 Capsules / Bottle", 22, 45, 40, 10, "LOT-2026-A", day(400)],
  ["MC-VITD-5000", "Vitamin D3 5000 IU", "Vitamins", "90 Softgels / Bottle", 30, 60, 25, 8, "LOT-2026-B", day(500)],
  ["MC-B12-1000", "Vitamin B12 1000mcg", "Vitamins", "100 Tablets / Bottle", 15, 35, 4, 8, "LOT-2025-C", day(60)],
  ["MC-MULTI-ADT", "Adult Daily Multivitamin", "Vitamins", "120 Tablets / Bottle", 40, 85, 30, 10, "LOT-2026-D", day(600)],
  ["MC-MAG-400", "Magnesium Glycinate 400mg", "Minerals", "90 Capsules / Bottle", 28, 58, 18, 6, "LOT-2026-E", day(450)],
  ["MC-IRON-65", "Iron 65mg + Folic Acid", "Minerals", "60 Tablets / Bottle", 12, 28, 0, 5, "LOT-2025-F", day(200)],
  ["MC-ASHW-600", "Ashwagandha Root 600mg", "Herbal & Botanicals", "60 Capsules / Bottle", 25, 55, 20, 6, "LOT-2026-G", day(380)],
  ["MC-MORI-500", "Moringa Leaf Powder", "Herbal & Botanicals", "200g Pouch", 18, 40, 15, 5, "LOT-2026-H", day(300)],
  ["MC-OMG-1200", "Omega-3 Fish Oil 1200mg", "Omega & Fish Oils", "120 Softgels / Bottle", 45, 95, 22, 8, "LOT-2026-I", day(420)],
  ["MC-PRO-50B", "Probiotic 50 Billion CFU", "Probiotics & Gut", "30 Capsules / Bottle", 55, 110, 12, 5, "LOT-2026-J", day(45)],
  ["MC-ELDB-SYR", "Elderberry Immune Syrup", "Immune & Wellness", "250ml Bottle", 20, 48, 3, 5, "LOT-2026-K", day(-10)],
  ["MC-COLL-PEP", "Collagen Peptides Powder", "Specialty", "300g Tub", 60, 130, 9, 4, "LOT-2026-L", day(540)],
].map((r, i) => ({
  id: "INV-SEED-" + (i + 1), sku: r[0], name: r[1], category: r[2], formType: r[3],
  cost: r[4], price: r[5], stock: r[6], reorder: r[7], batch: r[8], expiry: r[9]
}));

const patients = [
  ["Ama Mensah", "+233 24 111 2233", "ama.mensah@example.com", "1988-04-12", "Female", "None known", "Seeks energy support; takes Vitamin D3 daily."],
  ["Kwame Boateng", "+233 20 444 5566", "kwame.b@example.com", "1975-09-30", "Male", "Shellfish", "Hypertension (managed). Avoid fish-oil with shellfish-derived additives."],
  ["Efua Quaye", "+233 55 777 8899", "", "1995-01-22", "Female", "Soy", "Pregnant (2nd trimester) — iron and folic acid regimen."],
  ["Yaw Owusu", "+233 27 222 3344", "yaw.owusu@example.com", "1962-11-05", "Male", "None known", "Joint pain; omega-3 and magnesium."],
  ["Abena Darko", "+233 54 999 0011", "abena.d@example.com", "2001-06-18", "Female", "Lactose", "Gut health goals; probiotic course."],
  ["Kofi Annan Jr.", "+233 26 555 6677", "", "1983-03-09", "Male", "None known", "Fatigue; B12 deficiency suspected."],
].map((r, i) => ({
  id: "PT-SEED-" + (i + 1), code: "MC-PT-" + String(i + 1).padStart(3, "0"),
  name: r[0], phone: r[1], email: r[2], dob: r[3], gender: r[4], allergies: r[5], notes: r[6]
}));

const appointments = [
  { p: 0, off: 0, t: "09:00", type: "General Clinic Consultation", fee: 80, c: "Dr. Adjei", s: "Scheduled", n: "Routine check; discuss energy levels." },
  { p: 1, off: 0, t: "10:30", type: "Nutrition & Supplement Review", fee: 60, c: "Nutritionist Serwaa", s: "Checked In", n: "Review current regimen and allergies." },
  { p: 2, off: 1, t: "14:00", type: "Follow-Up Checkup", fee: 50, c: "Dr. Adjei", s: "Scheduled", n: "Prenatal follow-up; iron levels." },
  { p: 3, off: 2, t: "11:15", type: "Wellness & Preventive Screening", fee: 120, c: "Dr. Adjei", s: "Scheduled", n: "Annual wellness screening." },
  { p: 4, off: -3, t: "15:30", type: "Supplement Refill Pickup", fee: 0, c: "Pharmacist Nana", s: "Completed", n: "Probiotic refill." },
  { p: 5, off: -5, t: "08:45", type: "General Clinic Consultation", fee: 80, c: "Dr. Adjei", s: "Cancelled", n: "Patient rescheduled." },
].map((a, i) => ({
  id: "APPT-SEED-" + (i + 1), patientId: patients[a.p].id,
  patientName: `${patients[a.p].name} (${patients[a.p].code})`,
  date: day(a.off), time: a.t, type: a.type, consultationFee: a.fee,
  clinician: a.c, status: a.s, notes: a.n
}));

const line = (invIdx, qty) => {
  const p = inventory[invIdx];
  return { productId: p.id, sku: p.sku, name: p.name, price: p.price, qty };
};
const mkSale = (n, off, h, m, patIdx, apptId, items, consult, discount, taxRate, payments, note) => {
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
  const fee = consult ? consult[1] : 0;
  const tax = Number(((subtotal + fee - discount) * taxRate / 100).toFixed(2));
  const total = Number((subtotal + fee - discount + tax).toFixed(2));
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const pt = patIdx === null ? null : patients[patIdx];
  return {
    id: "SALE-SEED-" + n, receiptNo: "MC-RCP-" + String(n).padStart(4, "0"),
    timestamp: at(off, h, m),
    patientId: pt ? pt.id : "", patientName: pt ? `${pt.name} (${pt.code})` : "Walk-In Customer",
    appointmentId: apptId || "", items, subtotal,
    consultationType: consult ? consult[0] : "", consultationFee: fee,
    discount, tax, total, payments, totalPaid: paid,
    changeDue: Math.max(0, Number((paid - total).toFixed(2))),
    paymentMethod: payments.map(p => `${p.method}: GHC ${p.amount.toFixed(2)}${p.ref ? ` (${p.ref})` : ""}`).join(" + "),
    note: note || ""
  };
};

// Newest first, matching how the app lists sales.
const sales = [
  mkSale(4, 0, 9, 40, 0, "", [line(1, 1), line(0, 2)], null, 5, 0,
    [{ method: "Mobile Money (MoMo)", amount: 100, ref: "MOMO-88123" }], "Take Vitamin D3 once daily with breakfast."),
  mkSale(3, -1, 16, 5, null, "", [line(3, 1)], null, 0, 0,
    [{ method: "Cash", amount: 100, ref: "" }], ""),
  mkSale(2, -2, 11, 20, 4, "APPT-SEED-5", [line(9, 1)], ["Supplement Refill Pickup", 0], 0, 0,
    [{ method: "Card / POS Terminal", amount: 60, ref: "POS-4471" }, { method: "Cash", amount: 50, ref: "" }], "1 capsule daily after meal."),
  mkSale(1, -4, 13, 10, 1, "", [line(8, 1), line(4, 1)], ["General Clinic Consultation", 80], 10, 0,
    [{ method: "Mobile Money (MoMo)", amount: 200, ref: "MOMO-77410" }], "Omega-3 with dinner; magnesium at bedtime."),
];

store.write({
  currency: "GHC",
  settings: {
    clinicName: "Mediconny Clinic & Supplement Shop",
    address: "12 Independence Ave, Osu, Accra",
    phone: "+233 30 222 1234",
    taxId: "TIN-C0012345678",
    receiptFooter: "Thank you for visiting Mediconny Clinic & Shop!"
  },
  inventory, patients, appointments, sales
});
// Reflect sold quantities in stock so the demo data is consistent.
const state = store.read();
for (const s of sales) for (const l of s.items) {
  const p = state.inventory.find(i => i.id === l.productId);
  if (p) p.stock = Math.max(0, p.stock - l.qty);
}
store.write(state);
console.log(`Seeded: ${inventory.length} products, ${patients.length} patients, ${appointments.length} appointments, ${sales.length} sales.`);
