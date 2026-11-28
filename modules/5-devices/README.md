# 5 · Devices

**What it does.** Operators run two kinds of device:
- **Vending machine:** dispenses medicines. Checkout and QR codes come in Phase 3.
- **Medicine Checker:** a Raspberry Pi with a camera that reads the batch number, MFD, EXP and MRP on a strip.

**How a device gets to an operator:**
1. Admin registers it, which creates a **Device ID** and a **device key**. The key goes into the device's `config.json`.
2. At the pharmacy, the operator presses **Pair** on the device. Its OLED shows a **QR**, the Device ID and a **pairing code** (valid 10 minutes, works once).
3. The operator scans the QR with their phone. The website's **Link a device** page opens with both filled in, and they press **Link device**. (Or they type both on that page.) The device is now theirs, and its screen says "Linked".
4. The device itself uses the key to call the device API.

A device without a screen: admin presses **Pairing code (no-screen device)** on the device page and gives that code to the operator (works once, no time limit).

**Shared by all operators:** the medicine list (products, batches, recalls).
**Private to each operator:** their devices, stock, scans and stock log.

## Pages

| Page | File | Who |
|---|---|---|
| `/app/vendor` (devices) | `src/app/app/vendor/page.tsx` | operator (own), admin (all) |
| `/app/vendor/new` (register) | `src/app/app/vendor/new/` | admin |
| `/app/vendor/[id]` (one device) | `src/app/app/vendor/[id]/` | operator, admin |
| `/app/vendor/link` (link with pairing code) | `src/app/app/vendor/link/` | operator |
| `/L/<Device ID>/<code>` (where the device's QR points; opens the link page filled in) | `src/app/L/` | operator's phone |
| `/app/vendor/stock`, `stock/add` | `src/app/app/vendor/stock/` | operator |
| `/app/vendor/review` | `src/app/app/vendor/review/` | operator |
| `/app/vendor/sell-first` | `src/app/app/vendor/sell-first/` | operator |
| `/app/vendor/alerts` | `src/app/app/vendor/alerts/` | operator |
| `/app/vendor/scans` (+ reject bin) | `src/app/app/vendor/scans/` | operator |
| `/api/device/health · ping · snapshot · events · pairing-code` | `src/app/api/device/` | the device |

## Code

| File | What it does |
|---|---|
| `src/app/app/vendor/actions.ts` | register a device, replace key, pairing code for a no-screen device, activate (admin); link and edit a device (operator) |
| `src/app/api/device/pairing-code/route.ts` | the device's Pair button asks here for a code and QR to show on its screen |
| `src/lib/pairing-qr.ts` | the link in the QR, and the QR as rows of 1/0 (29×29, fits a 128×64 OLED) |
| `hardware/arduino/pair_screen/` | Arduino sketch that draws the QR and code on the OLED |
| `src/app/app/vendor/stock/actions.ts`, `review/actions.ts`, `alerts/actions.ts` | stock edits, review decisions, "Removed" |
| `src/lib/devices.ts` | make Device IDs, pairing codes and keys; hash them |
| `src/lib/device-api.ts`, `device-api-version.ts` | shared code for the API routes |
| `src/lib/medicine.ts`, `device-labels.ts` | batch / date / MRP formats, labels |

## Device software (in this folder)

| File | What it is |
|---|---|
| [`device-api.md`](device-api.md) | **the contract** between the website and the device: endpoints, formats, every field, what the server does with each scan |
| [`hardware/ft_device_client.py`](hardware/ft_device_client.py) | reference Python client for the Raspberry Pi (offline queue, sync, format helpers). See [`hardware/README.md`](hardware/README.md). |
| [`fake-checker.mjs`](fake-checker.mjs) | pretends to be a Medicine Checker, to test the server without hardware |

## Database (`database.sql`)

- **Tables:**
  - `machines` (devices) and `machine_slots`
  - `products`, `batches`, `recalls`: shared
  - `stock`, `scan_events`, `stock_movements`: private
  - `orders` and `dispense_tokens`: Phase 3, not used yet
- **The one "locked from sale" rule:** `batch_lock_reason()`. A batch is locked if it's expired, recalled, or (on vending machines) not confirmed.
- **View:** `stock_status`. This is what the stock pages read.
- **Functions:**
  - linking: `claim_device`
  - admin key reset: `set_device_secrets`
  - stock edits: `vendor_*`
  - device API: `device_snapshot`, `device_ping`, `device_ingest_events`, `device_set_pairing_code`
  - review: `vendor_review_*`

## Set up

1. **SQL Editor:** run `database.sql`, after modules 1–4.
2. **Vercel:** set `NEXT_PUBLIC_SITE_URL=https://farmacia-tech.vercel.app`. It goes into the device `config.json` shown at registration.

## Test

1. As admin, go to **Register device → Medicine Checker** and copy the `config.json` (it has the Device ID and key).
2. Press "Pair" without a device:
   ```bash
   node modules/5-devices/fake-checker.mjs --url https://farmacia-tech.vercel.app --key ftk_… --pair
   ```
   It prints a QR, the Device ID and a pairing code. Scan the QR with your phone and sign in as an operator (a test number), or go to **Link a device** and type both, within 10 minutes. Press **Link device**; the script then says "✓ Linked". On the device page, press **Use my current location** (on your phone, next to the device), check the map link, then **Save**. Then add one medicine via **Stock → Add stock by hand**.
3. Run the fake device:
   ```bash
   node modules/5-devices/fake-checker.mjs --url https://farmacia-tech.vercel.app --key ftk_…
   ```
   It should say **9/9 as expected**. Then check **Stock**, **Review** and **Scan log**.
4. Quick API check: open `https://farmacia-tech.vercel.app/api/device/health`. It should show `{"ok":true,"api":"1.4",…}`.
