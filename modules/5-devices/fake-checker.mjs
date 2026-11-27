#!/usr/bin/env node
/**
 * Pretends to be a Medicine Checker, so the website can be tested before the real device is ready.
 *
 *   node modules/5-devices/fake-checker.mjs --url http://localhost:3000 --key ftk_xxxxxxxx
 *
 * Get the key by registering a Medicine Checker on the website (Admin → Register device), then link it
 * to an operator account. For a useful run, add at least one medicine first (operator → Stock → Add stock).
 *
 * It downloads the snapshot, then sends one scan event of each kind (see modules/5-devices/device-api.md), resends one
 * (must come back "duplicate") and sends one with the wrong device ID (must be "rejected"). Then it prints
 * the device's stock as the server now sees it. Afterwards look at Stock, Review and Scan log on the website.
 * Nothing here is stored on the computer.
 */
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BASE = (args.url ?? process.env.FT_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = args.key ?? process.env.FT_DEVICE_KEY;
if (!KEY) {
  console.error("Usage: node modules/5-devices/fake-checker.mjs --url http://localhost:3000 --key ftk_xxxxxxxx");
  process.exit(1);
}

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-Device-Key": KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const ym = (d) => d.toISOString().slice(0, 7);
const now = new Date();
const nowIso = () => new Date().toISOString();
const field = (value, status) => ({ value: status === "not_found" ? "" : value, status });

// ---------- 1. Snapshot ----------
console.log(`\n→ GET ${BASE}/api/device/snapshot`);
const snap = await call("/api/device/snapshot");
if (snap.status !== 200) {
  console.error(`  HTTP ${snap.status}:`, snap.body);
  console.error(snap.status === 401 ? "  The key was rejected. Check it, and that the device is active." : "  Is the website running?");
  process.exit(1);
}
const s = snap.body;
const deviceId = s.device.deviceId;
console.log(`  Device ${deviceId} (${s.device.type}) · ${s.products.length} medicines · ${s.batches.length} confirmed batches · ${s.recalls.length} recalls · ${s.stock.length} stock rows`);
console.log(`  Server time ${s.serverTime}`);

const product = s.products[0];
const master = s.batches.find((b) => !b.locked);
if (!product) console.log("  ! No medicines on the server yet: the ACCEPT examples will be refused. Add one on Stock → Add stock by hand.");

// ---------- 2. Events ----------
const newCode = `FAKE-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const mfd = ym(new Date(now.getFullYear() - 1, now.getMonth(), 1));
const exp = ym(new Date(now.getFullYear() + 2, now.getMonth(), 1));
const base = { deviceId, softwareVersion: "fake-checker 1.0", attempts: 1, seconds: 3.4, personAnswer: "", reason: "" };
const ev = (label, expect, e) => ({ label, expect, event: { eventId: randomUUID(), time: nowIso(), ...base, ...e } });

const plan = [];
if (product) {
  plan.push(
    ev("restock ACCEPT, new batch", "saved, +5 stock", {
      mode: "restock", productId: product.productId, productName: product.productName, matchedMaster: false, decision: "ACCEPT", quantity: 5, sold: false,
      fields: { batch: field(newCode, "confirmed"), mfd: field(mfd, "confirmed"), exp: field(exp, "read"), mrp: field("45.50", "confirmed") },
    }),
  );
}
if (master) {
  plan.push(
    ev("restock ACCEPT, matched master, hidden fields from record", "saved, +2 stock (not downgraded)", {
      mode: "restock", productId: master.productId, productName: master.productName, matchedMaster: true, decision: "ACCEPT", quantity: 2, sold: false,
      fields: { batch: field(master.batchCode, "confirmed"), mfd: field(master.mfd, "from_record"), exp: field(master.exp, "confirmed"), mrp: field(master.mrp, "from_record") },
    }),
  );
}
if (product) {
  plan.push(
    ev("restock REVIEW, partly read", "saved, +3 stock marked not confirmed, in Review", {
      mode: "restock", productId: product.productId, productName: product.productName, matchedMaster: false, decision: "REVIEW", quantity: 3, sold: false,
      reason: "MRP hidden under a fold", personAnswer: "no",
      fields: { batch: field(`${newCode}R`, "read"), mfd: field("", "not_found"), exp: field(exp, "read"), mrp: field("", "not_found") },
    }),
  );
}
plan.push(
  ev("restock REVIEW, product unknown, no name", "saved, waits in Review for the product", {
    mode: "restock", productId: null, productName: "", matchedMaster: false, decision: "REVIEW", quantity: 4, sold: false,
    fields: { batch: field("UNK-1234", "read"), mfd: field("", "not_found"), exp: field("", "not_found"), mrp: field("", "not_found") },
  }),
  ev("restock REFUSE", "saved, nothing added, in Review", {
    mode: "restock", productId: null, productName: "", matchedMaster: false, decision: "REFUSE", quantity: 1, sold: false, reason: "Strip torn",
    fields: { batch: field("", "not_found"), mfd: field("", "not_found"), exp: field("", "not_found"), mrp: field("", "not_found") },
  }),
);
if (product) {
  plan.push(
    ev("check ACCEPT, sold", "saved, −1 stock", {
      mode: "check", productId: product.productId, productName: product.productName, matchedMaster: true, decision: "ACCEPT", quantity: 1, sold: true,
      fields: { batch: field(newCode, "confirmed"), mfd: field(mfd, "from_record"), exp: field(exp, "confirmed"), mrp: field("45.50", "from_record") },
    }),
  );
}
plan.push(
  ev("check REFUSE", "saved, in the reject bin", {
    mode: "check", productId: null, productName: "", matchedMaster: false, decision: "REFUSE", quantity: 1, sold: false, reason: "Expired strip",
    fields: { batch: field("OLD-0001", "read"), mfd: field("", "not_found"), exp: field("2020-01", "read"), mrp: field("", "not_found") },
  }),
);
if (plan[0]) plan.push({ label: "same eventId again", expect: "duplicate", event: plan[0].event });
plan.push(
  ev("wrong deviceId", "rejected", {
    deviceId: "FT-MC-NOTME1", mode: "check", productId: null, productName: "", decision: "REFUSE", fields: {},
  }),
);

console.log(`\n→ POST ${BASE}/api/device/events (${plan.length} events)`);
const sent = await call("/api/device/events", { method: "POST", body: JSON.stringify({ events: plan.map((p) => p.event) }) });
if (sent.status !== 200) {
  console.error(`  HTTP ${sent.status}:`, sent.body);
  process.exit(1);
}
let ok = 0;
sent.body.results.forEach((r, i) => {
  const p = plan[i];
  const got = r.status + (r.decision ? ` (${r.decision})` : "") + (r.error ? ` — ${r.error}` : "");
  const pass = p.expect.startsWith(r.status) || (r.status === "saved" && p.expect.startsWith("saved"));
  if (pass) ok++;
  console.log(`  ${pass ? "✓" : "✗"} ${p.label.padEnd(56)} ${got}`);
  if (!pass) console.log(`      expected: ${p.expect}`);
});
console.log(`  ${ok}/${plan.length} as expected`);

// ---------- 3. Stock now ----------
const after = await call("/api/device/snapshot");
console.log(`\n→ Stock on ${deviceId} now`);
for (const r of after.body.stock ?? []) {
  const flags = [r.notConfirmed && "not confirmed", r.locked && `locked: ${r.lockReason}`].filter(Boolean).join(", ");
  console.log(`  ${`${r.productName} ${r.strength ?? ""}`.trim().padEnd(28)} ${r.batchCode.padEnd(14)} ${String(r.quantity).padStart(5)}${flags ? `  (${flags})` : ""}`);
}
console.log("\nNow open the website as this device's operator: Stock, Review and Scan log show what happened.\n");
