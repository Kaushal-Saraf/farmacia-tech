# Device software helpers

`ft_device_client.py` is a reference client for the device API ([`../device-api.md`](../device-api.md), v1.3). Python 3.9+, standard library only, so it runs on a stock Raspberry Pi OS.

## Set up a device

1. On the website: **Admin → Register device → Medicine Checker**. Copy the **Device config file** it shows.
2. On the Pi, save it as `config.json` next to your app, then: `chmod 600 config.json`.
3. Check it:
   ```bash
   python3 ft_device_client.py health
   python3 ft_device_client.py ping
   python3 ft_device_client.py snapshot
   python3 ft_device_client.py selftest
   ```
   `selftest` sends one harmless check/REFUSE scan: it only shows up in the operator's reject bin.
4. Link it to the operator:
   ```bash
   python3 ft_device_client.py pair
   ```
   It prints the Device ID and a pairing code (valid 10 minutes, works once). The operator types both on the website: **My devices → Link a device**.

## The Pair button (device app)

The device needs a **Pair** menu item. When pressed:

```python
p = client.request_pairing_code()          # POST /api/device/pairing-code
if p["linked"] and not ask("Already linked. Show a code anyway?"):
    return
show(p["deviceId"], p["pairingCode"])      # on the display, until p["expiresAt"] (10 minutes)
```

Pressing it again makes a new code and the old one stops working. Don't write the code to logs.

## Use it in the device app

```python
from ft_device_client import DeviceClient, field, normalise_batch_code, normalise_month, normalise_mrp

client = DeviceClient("https://farmacia-tech.vercel.app", device_key, data_dir="/var/lib/ft")
client.fetch_snapshot()                       # or client.cached_snapshot() when offline

batch = normalise_batch_code(ocr["batch"])    # 'B.No. nbt-240586' -> 'NBT-240586'
exp = normalise_month(ocr["exp"])             # 'EXP 05/2026' -> '2026-05'
event = client.make_event(
    "restock", "ACCEPT", product_id=pid, product_name="Dolo 650", quantity=1,
    fields={"batch": field(batch, "confirmed"), "mfd": field(mfd, "from_record"),
            "exp": field(exp, "confirmed"), "mrp": field(mrp, "from_record")},
    matched_master=True, attempts=1, seconds=3.1)
client.enqueue(event)                          # save first, then show the result on screen
client.upload_pending()                        # or run client.run_forever() in a background thread
```

`client.lock_reason(product_id, batch_code, exp)` tells you offline whether a batch is recalled or expired (India time, corrected with the server clock).

## Files it keeps (in `data_dir`)

- `snapshot.json`: the last snapshot, written atomically
- `queue.db`: SQLite queue of scans (`pending` → `done`, or `failed` with the server's reason)
