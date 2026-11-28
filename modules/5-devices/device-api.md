# Device API: Medicine Checker ↔ Farmacia Tech

This is the contract between the website and the device software. Both sides follow it exactly; change it here first.

**Version 1.4 (28 Nov 2026).** Implemented in `modules/5-devices/database.sql` (the `device_*` functions) and `src/app/api/device/`.
Reference device client (Python, standard library only): [`hardware/ft_device_client.py`](hardware/ft_device_client.py).
Server test without hardware: `node modules/5-devices/fake-checker.mjs --url <base URL> --key ftk_…`.

Changes in 1.4:
- The pairing-code response also has `pairingUrl` and `qr` (the QR as rows of `1`/`0`), so a small OLED can show a QR the operator scans with their phone. No QR library is needed on the device.
- `ping` also returns `linked` and `pairingOpen` (false as soon as the operator has used the code), so the pairing screen can say "Linked".

Changes in 1.3:
- `POST /api/device/pairing-code`: the device asks for a pairing code and shows it on its own screen with its Device ID. The operator types both on the website to link the device. Valid 10 minutes, works once. Registration no longer hands out a pairing code.

Changes in 1.2:
- `GET /api/device/health` (no key) to check the network and the server clock.
- `GET /api/device/ping`, a small heartbeat returning `snapshotVersion`. Download the full snapshot only when it changes.
- The snapshot also carries `snapshotVersion`.
- Event results include `decision`: what the server applied.

Changes in 1.1:
- REVIEW and REFUSE scans may have no medicine name (`productId: null`, `productName: ""`), because the checker has no keyboard. The owner sets the product on the website. ACCEPT still requires `productName`.
- `matchedMaster: true` plus fields with status `from_record` is a valid ACCEPT. The server never downgrades it because of those fields.

## 0. Base URL and endpoints

| Where the server runs | Base URL |
|---|---|
| Live site (after this branch is merged and deployed) | `https://farmacia-tech.vercel.app` |
| A computer on the same Wi-Fi, running `npm run dev` | `http://<that computer's IP>:3000`, e.g. `http://192.168.1.20:3000` (`localhost` only works on the computer itself) |

| Method | Path | Key | Purpose | How often |
|---|---|---|---|---|
| GET | `/api/device/health` | no | Network and clock check | at startup, when debugging |
| GET | `/api/device/ping` | yes | Heartbeat, `snapshotVersion` | every `pollSeconds` (60) |
| GET | `/api/device/snapshot` | yes | Full offline copy | at startup and when `snapshotVersion` changes |
| POST | `/api/device/events` | yes | Upload scans (≤100 per request) | whenever the queue has pending scans |
| POST | `/api/device/pairing-code` | yes | A code to show on screen so an operator can link the device | when someone presses **Pair** |

All responses are JSON with `Cache-Control: no-store`. Always use HTTPS on the live site.

**Why not WebSockets.** The website runs on Vercel, which does not keep WebSocket connections open, and the checker must work offline anyway. Polling `ping` every 60 s costs one tiny request a minute and picks up changes (new recall, stock edit, new medicine, midnight expiry) within a minute. If push is ever needed (e.g. for vending-machine dispense commands in Phase 3), the planned upgrade is Supabase Realtime with a short-lived device token; `ping` stays as the fallback.

**Suggested sync loop** (what `hardware/ft_device_client.py` does in `run_forever`):

```
on start:        health → ping → snapshot (or use the saved snapshot.json if offline)
every 60 s:      ping
                 if ping.snapshotVersion != saved snapshot.snapshotVersion → snapshot
                 upload pending scans (oldest first, ≤100 per request)
on each scan:    save to the local queue FIRST, then show the result, then try to upload
offline:         keep working from snapshot.json; retry after 10 s, 30 s, 1 min, 5 min, then every 15 min
on HTTP 401:     stop syncing, show "Device key rejected - contact Farmacia Tech"
```

## 1. Identity

Each device is registered on the website (Admin → Register device) and gets:

| | Example | Notes |
|---|---|---|
| Device ID | `FT-MC-4HT8PW` | Printed on the device. `FT-MC-` = Medicine Checker, `FT-VM-` = vending machine. |
| Device key | `ftk_…` | Secret. Stored on the device only; the website keeps a SHA-256 hash. |
| Pairing code | `K7QM-3XHP` | Shown on the device's screen when someone presses **Pair** (see 3c). The operator types it on the website with the Device ID. Valid 10 minutes, works once. |

Every request sends the key in this header:

```
X-Device-Key: <device key>
```

The key alone identifies the device. A wrong key, or a deactivated device, gets **HTTP 401**. Every successful request updates the device's "last seen" time.

## 2. Formats

| Field | Format | Example |
|---|---|---|
| `productName` | 1–200 characters. Required for ACCEPT; may be `""` for REVIEW and REFUSE. | `Paracetamol` |
| `batchCode` | Exactly as printed. Capitals, hyphens kept, no spaces. Characters `A-Z 0-9 - / .`, max 40, starts with a letter or digit. | `NBT-240586` |
| `mfd`, `exp` | `YYYY-MM` | `2026-05` |
| `mrp` | String with exactly two decimals | `140.70` |
| `time` | ISO 8601 with a timezone | `2026-11-14T15:42:10+05:30` |

Expiry `2026-05` means usable until **31 May 2026, India time**. It is expired from 1 June.

## 3. `GET /api/device/snapshot`

Everything the device needs to work offline.

```json
{
  "serverTime": "2026-11-14T10:12:31Z",
  "snapshotVersion": "7afa187ad612ee8f",
  "device": { "deviceId": "FT-MC-4HT8PW", "type": "checker", "name": "City Pharmacy bench" },
  "products": [
    { "productId": "uuid", "productName": "Paracetamol", "strength": "500 mg", "manufacturer": "Acme", "packSize": "10 tablets" }
  ],
  "batches": [
    { "productId": "uuid", "productName": "Paracetamol", "strength": "500 mg",
      "batchCode": "NBT-240586", "mfd": "2024-05", "exp": "2027-04", "mrp": "140.70",
      "locked": false, "lockReason": null }
  ],
  "recalls": [
    { "productId": "uuid", "productName": "Paracetamol", "strength": "500 mg",
      "batchCode": "RCL-5", "reason": "Failed dissolution test", "recalledOn": "2026-10-01" }
  ],
  "stock": [
    { "productId": "uuid", "productName": "Paracetamol", "strength": "500 mg",
      "batchCode": "NBT-240586", "quantity": 12, "shelf": "A1",
      "notConfirmed": false, "locked": false, "lockReason": null }
  ]
}
```

- `batches` contains every **confirmed** batch in the shared master (`confirmed_on_device` or `confirmed_on_website`).
- `stock` is this device's own stock, including unverified batches, which are marked `notConfirmed: true`.
- `lockReason` is `"expired"`, `"recalled"` or `null`. A locked batch must never be accepted as sellable. (For a vending machine, stock rows can also be locked with `"not_confirmed"`: unverified batches are never dispensed.)
- A device restock scan adds to that batch's existing stock row on the device (whatever its shelf); the owner can set shelves on the website.

## 3a. `GET /api/device/ping`

```json
{ "serverTime": "2026-11-26T10:12:31Z", "deviceId": "FT-MC-4HT8PW", "name": "City Pharmacy bench",
  "snapshotVersion": "7afa187ad612ee8f", "pollSeconds": 60, "linked": true, "pairingOpen": false }
```

`linked`: the device belongs to an operator. `pairingOpen`: a pairing code is waiting to be used (see 3c).

`snapshotVersion` changes when medicines, confirmed batches, recalls, this device's stock, the device name, or the date (India time) change. Compare it with the `snapshotVersion` in your saved snapshot. Ping also updates the device's "last seen" time on the website.

## 3b. `GET /api/device/health`

No key. `{ "ok": true, "api": "1.4", "serverTime": "2026-11-26T10:12:31Z" }`

## 3c. `POST /api/device/pairing-code`

Key required, no body. Call it when someone presses **Pair** on the device.

```json
{ "deviceId": "FT-MC-4HT8PW", "pairingCode": "K7QM-3XHP",
  "expiresAt": "2026-11-28T10:22:31Z", "linked": false,
  "pairingUrl": "HTTPS://FARMACIA-TECH.VERCEL.APP/L/FT-MC-4HT8PW/K7QM3XHP",
  "qr": ["11111110100000011000101111111", "10000010…", "… 29 rows in all"] }
```

Show the QR, `deviceId` and `pairingCode` on the screen until `expiresAt` (10 minutes). The operator either:
- **scans the QR** with their phone camera. It opens the website's **Link a device** page with both filled in (after signing in, if needed); they press **Link device**. Or
- signs in, opens **My devices → Link a device**, and types the Device ID and code.

The code works once; each request replaces the previous code. While the code is shown, ping every 3 seconds: when `pairingOpen` turns `false` before `expiresAt`, the operator has linked it, so show "Linked".

**The QR.** `qr` is the QR of `pairingUrl`, top row first, `"1"` = dark square, `"0"` = light. There is no border in the data: draw at least one light square around it. It is 29×29 squares (version 3), so on a **128×64 OLED** it fits at 2 pixels per square in the left 64×64 (58 px plus a 3 px light border). Light = lit pixel, dark = unlit, so light the whole 64×64 square first and then clear the dark squares. The link is all capitals on purpose: that keeps the QR at 29×29. The website accepts it in any case.

`linked: true` means the device already belongs to an operator. A new code lets another operator take it over (for example, a device that is sold or moved), so the device should ask "Already linked. Show a code anyway?" before showing it.

Only the device (with its key) can get a code this way, so a stolen Device ID alone is not enough to take a device. For a device without a screen, admin can issue a code from the device page on the website; that code works once and does not expire.

## 4. `POST /api/device/events`

Body: `{ "events": [ … ] }`, with at most 100 events per request.

```json
{
  "eventId": "uuid-v4 made on the device",
  "deviceId": "FT-MC-4HT8PW",
  "time": "2026-11-14T15:42:10+05:30",
  "mode": "restock",
  "productId": "uuid or null",
  "productName": "Paracetamol",
  "fields": {
    "batch": { "value": "NBT-240586", "status": "confirmed" },
    "mfd":   { "value": "2024-05",    "status": "from_record" },
    "exp":   { "value": "2027-04",    "status": "confirmed" },
    "mrp":   { "value": "140.70",     "status": "from_record" }
  },
  "matchedMaster": true,
  "decision": "ACCEPT",
  "reason": "",
  "personAnswer": "",
  "quantity": 1,
  "sold": false,
  "attempts": 1,
  "seconds": 4.2,
  "softwareVersion": "1.0.0"
}
```

Field status values:

| Status | Meaning |
|---|---|
| `confirmed` | Read from the strip and confirmed. |
| `read` | Read from the strip, not confirmed. |
| `from_record` | Hidden on the strip; the value was copied from the matched master batch. Only valid with `matchedMaster: true`. |
| `not_found` | Not read. `value` is `""`. |

`matchedMaster: true` means the batch code read from the strip matched a **confirmed** batch in the snapshot.

### Response

```json
{ "results": [ { "eventId": "…", "status": "saved" }, { "eventId": "…", "status": "duplicate" },
               { "eventId": "…", "status": "rejected", "error": "deviceId does not match this key" } ] }
```

| Status | Device should |
|---|---|
| `saved` | Mark the event done. The result also has `decision`: what the server applied (ACCEPT, REVIEW or REFUSE). |
| `duplicate` | Mark it done. The server already had this `eventId`; resending is always safe. |
| `rejected` | Keep it with the error and don't retry. |

| HTTP | Meaning |
|---|---|
| 200 | Results per event, as above. |
| 400 | The whole body is malformed (not JSON, no `events` array, more than 100 events). |
| 401 | Bad key or deactivated device. |
| 5xx / timeout | Retry later with backoff. |

## 5. How the server checks each event

**Rejected** (saved nowhere, `status: "rejected"`) when:
- `deviceId` is not the Device ID belonging to the key
- `eventId` is missing or longer than 100 characters
- `time` is not ISO 8601 with a timezone, or is more than 10 minutes in the future
- `mode`, `decision`, `personAnswer` or a field `status` has a value not listed above
- `decision` is ACCEPT and `productName` is empty
- `quantity` is not a whole number from 1 to 1000, `attempts` is not 1–3, or `seconds` is negative
- a text field is longer than its limit (`productName` 200, `reason` 500, `softwareVersion` 40)

Everything else is **saved**, then applied as follows.

### restock + ACCEPT

The server accepts it as sent when all of these hold. Otherwise it saves the event as **REVIEW**, with the reason recorded.

1. `productId` is set and exists.
2. The batch code is present and in the right format.
3. **If `matchedMaster` is true:**
   - A confirmed batch with this product and batch code must exist on the server.
   - Fields marked `from_record` (or `not_found`) take the master value. They never cause a downgrade.
   - Fields marked `confirmed` or `read` must equal the master value. A difference is a real conflict and goes to REVIEW.
4. **If `matchedMaster` is false** (a new batch):
   - `mfd`, `exp` and `mrp` must all be present, in the right format, with status `confirmed` or `read`. `from_record` without a master match goes to REVIEW.
   - If the batch already exists as confirmed, the values must agree. If it exists as unverified, this scan confirms it (`confirmed_on_device`).

When accepted: the batch is created if new (`confirmed_on_device`), and `quantity` is added to this device's stock.

### restock + REVIEW
- **Product and batch code known:** the batch is created as `unverified` (or the existing one is used), the stock is added and marked "not confirmed", and the scan goes to the owner's review list.
- **Product unknown** (`productId` null, or `productName` empty) **or batch code missing:** the scan waits in the review list with no stock added. When the owner picks or types the product and confirms, the batch and stock are created.

### restock + REFUSE
Nothing is added. The scan goes to the review list so the owner can add it by hand.

### check + ACCEPT, sold = true
This device's stock of that batch goes down by 1. If the device has no stock of that batch, or the batch is locked on the server, the event is still saved, stock never goes below zero, and it goes to the review list.

### check + REVIEW
Goes to the review list.

### check + REFUSE
Goes to the owner's reject bin.

## 6. Device behaviour (summary for the device software)

- Save the snapshot to disk and fetch it at startup, every 15 minutes, and after each successful upload. Use `serverTime` to correct clock drift.
- Queue every scan in local storage before showing the result. Upload oldest-first, up to 100 at a time.
- Retry network errors and 5xx with backoff. On 401, stop and show "Device key rejected".
- Never log the device key. The pairing code may be shown on screen but should not be written to logs either.
