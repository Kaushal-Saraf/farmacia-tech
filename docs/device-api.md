# Device API: Medicine Checker ↔ Farmacia Tech

This is the contract between the website and the device software. Both sides follow it exactly; change it here first.

**Version 1.1 (14 Nov 2026).** Changes from 1.0:
- REVIEW and REFUSE scans may have no medicine name (`productId: null`, `productName: ""`), because the checker has no keyboard. The owner sets the product on the website. ACCEPT still requires `productName`.
- `matchedMaster: true` plus fields with status `from_record` is a valid ACCEPT. The server never downgrades it because of those fields.

## 1. Identity

Each device is registered on the website (Admin → Register device) and gets:

| | Example | Notes |
|---|---|---|
| Device ID | `FT-MC-4HT8PW` | Printed on the device. `FT-MC-` = Medicine Checker, `FT-VM-` = vending machine. |
| Device key | `ftk_…` | Secret. Stored on the device only; the website keeps a SHA-256 hash. |
| Pairing code | `K7QM-3XHP` | Given to the operator to link the device to their account. Not used by the device. |

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
- `lockReason` is `"expired"`, `"recalled"` or `null`. A locked batch must never be accepted as sellable.

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
| `saved` | Mark the event done. |
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
- Never log the device key.
