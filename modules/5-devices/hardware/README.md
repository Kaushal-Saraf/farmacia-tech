# Device software helpers

`ft_device_client.py` is a reference client for the device API ([`../device-api.md`](../device-api.md), v1.4). Python 3.9+, standard library only, so it runs on a stock Raspberry Pi OS.

| File | What it is |
|---|---|
| `ft_device_client.py` | Runs on the Pi: talks to the website, offline queue, Pair button |
| `arduino/pair_screen/pair_screen.ino` | Runs on the Arduino: draws the pairing QR and code on the 128×64 OLED |

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
   It prints a QR, the Device ID and a pairing code (valid 10 minutes, works once), then waits. The operator scans the QR with their phone (or types both on the website: **My devices → Link a device**) and presses **Link device**. It then prints "✓ Linked".
   With the OLED connected: `python3 ft_device_client.py pair --serial /dev/ttyACM0` (needs `pip install pyserial`).

## The Pair button (device app)

The device needs a **Pair** menu item (one of the three buttons). The operator never types anything on the device: they scan the QR on its screen with their phone.

```
Pi (Python)                              Arduino + 128x64 OLED                 Operator's phone
-----------                              ---------------------                 ----------------
p = client.request_pairing_code()
send_lines(ser, client.pair_screen_lines(p))  ->  draws QR + Device ID + code
linked = client.wait_for_link(p)                  counts down 10:00             scans QR -> Link a device page
                                                                                (filled in) -> Link device
send_lines(ser, ["DONE Linked"])            ->  "Linked"
```

```python
import serial                                   # pip install pyserial
from ft_device_client import DeviceClient, send_lines

ser = serial.Serial("/dev/ttyACM0", 115200, timeout=2)   # then wait 2 s: the Arduino restarts
p = client.request_pairing_code()              # POST /api/device/pairing-code
if p["linked"] and not ask("Already linked. Show a code anyway?"):
    return
send_lines(ser, client.pair_screen_lines(p))   # the Arduino answers OK to each line
linked = client.wait_for_link(p)               # pings every 3 s until used or expired
send_lines(ser, ["DONE Linked" if linked else "DONE Expired"])
```

Pressing it again makes a new code and the old one stops working. Don't write the code to logs.

### The Arduino sketch

`arduino/pair_screen/pair_screen.ino` only draws; the Pi makes the QR (the server sends it as rows of `1`/`0`), so no QR library is needed on the Arduino.

1. Arduino IDE → Library Manager: install **Adafruit SSD1306** and **Adafruit GFX**.
2. Wiring (Uno/Nano): OLED SDA → A4, SCL → A5, VCC → 5V, GND → GND.
3. Open the sketch and upload. The screen shows "Farmacia Tech / Ready".
4. On the Pi: `python3 ft_device_client.py pair --serial /dev/ttyACM0`.

Commands it understands (115200 baud, one per line, each answered with `OK`): `PAIR <size>`, `Q <row> <bits>`, `SHOW <deviceId> <code> <seconds>`, `DONE Linked|Expired`, `CLEAR`. If your Arduino already runs a sketch for the buttons, copy `handleLine()` and the draw functions into it.

Notes:
- It is written for the common **0.96" 128×64 SSD1306** (I2C address `0x3C`; some boards use `0x3D`). A **1.3" SH1106** needs the Adafruit SH110X library instead (same drawing calls). A **128×32** screen is too small for a scannable QR: show only the Device ID and code there.
- Tested by compiling the sketch on a computer with a stand-in screen and reading the drawn QR back with a QR reader. Not yet tried on real hardware.

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
