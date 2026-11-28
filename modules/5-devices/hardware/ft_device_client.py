#!/usr/bin/env python3
"""
Farmacia Tech device client: reference implementation of modules/5-devices/device-api.md (version 1.3).

Standard library only (Python 3.9+, e.g. Raspberry Pi OS). Drop this file into the device software and use
`DeviceClient`, or run it from the command line to test the connection:

    python3 ft_device_client.py --config config.json health      # network + server clock (no key needed)
    python3 ft_device_client.py --config config.json ping        # key check + snapshot version
    python3 ft_device_client.py --config config.json snapshot    # download and save the offline copy
    python3 ft_device_client.py --config config.json pair        # pairing code for the operator (show it on screen)
    python3 ft_device_client.py --config config.json selftest    # send one harmless scan (goes to the reject bin)
    python3 ft_device_client.py --config config.json status      # queue: pending / failed uploads
    python3 ft_device_client.py --config config.json run         # sync loop: ping, snapshot when changed, upload

config.json (from Admin → Register device on the website; keep it chmod 600):
    {"baseUrl": "https://farmacia-tech.vercel.app", "deviceId": "FT-MC-4HT8PW", "deviceKey": "ftk_..."}

What it does for the device software:
  * keeps an offline copy of the snapshot (snapshot.json) and the server-clock offset
  * queues every scan in SQLite (queue.db) BEFORE it is shown on screen, so power loss can't lose it
  * uploads oldest-first in batches of up to 100, retrying network errors with backoff
  * "saved"/"duplicate" -> done, "rejected" -> failed (kept, with the reason), 401 -> stops with KeyRejected
  * helpers to normalise what OCR reads: batch code, MFD/EXP ("05/2026", "MAY 26" -> "2026-05"), MRP ("Rs.140.7" -> "140.70")
The device key is never printed or logged.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import re
import sqlite3
import stat
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from typing import Any, Optional

API_VERSION = "1.2"
CLIENT_VERSION = "ref-client 1.0"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
BACKOFF_SECONDS = [10, 30, 60, 300, 900]  # then stays at 15 minutes
MAX_BATCH = 100

log = logging.getLogger("ft-device")

# ---------------------------------------------------------------------------
# Formats (modules/5-devices/device-api.md §2). The server rejects or downgrades anything else.
# ---------------------------------------------------------------------------
BATCH_RE = re.compile(r"^[A-Z0-9][A-Z0-9./-]{0,39}$")
YM_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
MRP_RE = re.compile(r"^\d{1,6}\.\d{2}$")
FIELD_STATUSES = {"confirmed", "read", "from_record", "not_found"}
MONTHS = {m: i + 1 for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}


def normalise_batch_code(raw: Optional[str]) -> Optional[str]:
    """'B.No. nbt-240586' -> 'NBT-240586'. Capitals, hyphens kept, no spaces. None if it can't be valid."""
    if not raw:
        return None
    v = raw.strip().upper()
    v = re.sub(r"^(B\.?\s*NO\.?|BATCH\s*(NO\.?)?|LOT)\s*[:.]?\s*", "", v)
    v = re.sub(r"\s+", "", v)
    return v if BATCH_RE.match(v) else None


def normalise_month(raw: Optional[str]) -> Optional[str]:
    """'05/2026', '5-26', 'MAY 2026', 'MAY.26', '2026-05' -> '2026-05'. None if not a month."""
    if not raw:
        return None
    v = raw.strip().upper()
    v = re.sub(r"^(MFG|MFD|MANUFACTURED|EXP|EXPIRY|USE BEFORE|BEST BEFORE)\.?\s*(DATE)?\s*[:.]?\s*", "", v)
    m = re.match(r"^(\d{4})[-/.](\d{1,2})$", v)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
    else:
        m = re.match(r"^(\d{1,2})\s*[-/. ]\s*(\d{2}|\d{4})$", v) or re.match(r"^([A-Z]{3})[A-Z]*\s*[-/. ]?\s*(\d{2}|\d{4})$", v)
        if not m:
            return None
        mo = int(m.group(1)) if m.group(1).isdigit() else MONTHS.get(m.group(1)[:3], 0)
        y = int(m.group(2))
        y = y + 2000 if y < 100 else y
    if not (1 <= mo <= 12 and 1990 <= y <= 2100):
        return None
    return f"{y:04d}-{mo:02d}"


def normalise_mrp(raw: Optional[str]) -> Optional[str]:
    """'MRP Rs.140.7', '₹ 140', '140.70/-' -> '140.70'. None if not a price."""
    if not raw:
        return None
    v = raw.upper().replace("₹", "").replace(",", "")
    v = re.sub(r"(M\.?R\.?P\.?|RS\.?|INR|INCL\.? OF ALL TAXES|/-)", " ", v)
    m = re.search(r"\d{1,6}(\.\d{1,2})?", v)
    if not m:
        return None
    return f"{float(m.group(0)):.2f}"


def expiry_last_day(ym: str) -> dt.date:
    """'2026-05' means usable until 31 May 2026."""
    y, m = int(ym[:4]), int(ym[5:7])
    first_next = dt.date(y + (m == 12), 1 if m == 12 else m + 1, 1)
    return first_next - dt.timedelta(days=1)


def field(value: Optional[str], status: str) -> dict:
    """One entry of an event's `fields`. value is '' when status is not_found."""
    if status not in FIELD_STATUSES:
        raise ValueError(f"field status must be one of {sorted(FIELD_STATUSES)}")
    return {"value": "" if status == "not_found" or value is None else str(value), "status": status}


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------
class KeyRejected(Exception):
    """HTTP 401: wrong key, or the device was deactivated. Stop syncing and show it on screen."""


class NetworkError(Exception):
    """No connection, timeout, or a 5xx from the server. Try again later."""


class DeviceClient:
    def __init__(self, base_url: str, device_key: str, data_dir: str = "ft-data",
                 software_version: str = CLIENT_VERSION, timeout: float = 15.0):
        if not device_key or len(device_key) < 10:
            raise ValueError("device key missing")
        self.base = base_url.rstrip("/")
        self._key = device_key
        self.data_dir = data_dir
        self.software_version = software_version
        self.timeout = timeout
        self.device_id: Optional[str] = None
        self.clock_offset = 0.0  # server time minus local time, in seconds
        self.poll_seconds = 60
        os.makedirs(data_dir, exist_ok=True)
        self.db = sqlite3.connect(os.path.join(data_dir, "queue.db"))
        self.db.execute("""create table if not exists events (
            event_id text primary key, body text not null, created_at real not null,
            status text not null default 'pending', error text, attempts int not null default 0, next_try real not null default 0)""")
        self.db.execute("create table if not exists meta (k text primary key, v text)")
        self.db.commit()
        snap = self.cached_snapshot()
        if snap:
            self.device_id = snap.get("device", {}).get("deviceId")

    def __repr__(self) -> str:  # never show the key
        return f"DeviceClient({self.base!r}, device={self.device_id!r})"

    # ---- HTTP ----
    def _request(self, method: str, path: str, body: Any = None, auth: bool = True) -> tuple[int, Any]:
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Accept": "application/json", "User-Agent": f"FarmaciaTechDevice/{self.software_version}"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if auth:
            headers["X-Device-Key"] = self._key
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return res.status, json.loads(res.read() or b"null")
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read() or b"null")
            except ValueError:
                payload = None
            if e.code >= 500:
                raise NetworkError(f"HTTP {e.code}") from None
            return e.code, payload
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise NetworkError(str(getattr(e, "reason", e))) from None

    def _note_server_time(self, server_time: Optional[str]) -> None:
        if server_time:
            server = dt.datetime.fromisoformat(server_time.replace("Z", "+00:00"))
            self.clock_offset = server.timestamp() - time.time()

    # ---- endpoints ----
    def health(self) -> dict:
        status, body = self._request("GET", "/api/device/health", auth=False)
        if status != 200:
            raise NetworkError(f"HTTP {status}")
        self._note_server_time(body.get("serverTime"))
        return body

    def ping(self) -> dict:
        status, body = self._request("GET", "/api/device/ping")
        if status == 401:
            raise KeyRejected("Device key rejected - contact Farmacia Tech")
        if status != 200:
            raise NetworkError(f"HTTP {status}: {body}")
        self._note_server_time(body.get("serverTime"))
        self.device_id = body.get("deviceId") or self.device_id
        self.poll_seconds = int(body.get("pollSeconds") or 60)
        return body

    def request_pairing_code(self) -> dict:
        """For the device's Pair button: returns deviceId, pairingCode, expiresAt (10 min) and linked.
        Show deviceId and pairingCode on the screen; the operator types both on the website. Don't log the code."""
        status, body = self._request("POST", "/api/device/pairing-code")
        if status == 401:
            raise KeyRejected("Device key rejected - contact Farmacia Tech")
        if status != 200:
            raise NetworkError(f"HTTP {status}: {body}")
        self.device_id = body.get("deviceId") or self.device_id
        return body

    def fetch_snapshot(self) -> dict:
        status, body = self._request("GET", "/api/device/snapshot")
        if status == 401:
            raise KeyRejected("Device key rejected - contact Farmacia Tech")
        if status != 200:
            raise NetworkError(f"HTTP {status}: {body}")
        self._note_server_time(body.get("serverTime"))
        self.device_id = body["device"]["deviceId"]
        path = os.path.join(self.data_dir, "snapshot.json")
        fd, tmp = tempfile.mkstemp(dir=self.data_dir, suffix=".tmp")
        with os.fdopen(fd, "w") as f:  # write then rename: a power cut never leaves half a file
            json.dump(body, f)
        os.replace(tmp, path)
        self._meta_set("last_snapshot", str(time.time()))
        return body

    def cached_snapshot(self) -> Optional[dict]:
        try:
            with open(os.path.join(self.data_dir, "snapshot.json")) as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    # ---- time and locks ----
    def server_now(self) -> dt.datetime:
        return dt.datetime.fromtimestamp(time.time() + self.clock_offset, tz=dt.timezone.utc)

    def today_india(self) -> dt.date:
        return self.server_now().astimezone(IST).date()

    def find_batch(self, product_id: str, batch_code: str) -> Optional[dict]:
        """A confirmed batch from the offline copy (for matchedMaster), or None."""
        for b in (self.cached_snapshot() or {}).get("batches", []):
            if b["productId"] == product_id and b["batchCode"] == batch_code:
                return b
        return None

    def lock_reason(self, product_id: str, batch_code: str, exp: Optional[str]) -> Optional[str]:
        """'recalled' / 'expired' / None, from the offline copy and today's date (works without internet)."""
        snap = self.cached_snapshot() or {}
        if any(r["productId"] == product_id and r["batchCode"] == batch_code for r in snap.get("recalls", [])):
            return "recalled"
        b = self.find_batch(product_id, batch_code)
        exp = exp or (b or {}).get("exp")
        if exp and YM_RE.match(exp) and expiry_last_day(exp) < self.today_india():
            return "expired"
        return (b or {}).get("lockReason")

    # ---- events ----
    def make_event(self, mode: str, decision: str, *, product_id: Optional[str] = None, product_name: str = "",
                   fields: Optional[dict] = None, matched_master: bool = False, reason: str = "", person_answer: str = "",
                   quantity: int = 1, sold: bool = False, attempts: int = 1, seconds: float = 0.0) -> dict:
        """Builds a valid event (modules/5-devices/device-api.md §4). Raises ValueError for anything the server would reject."""
        if mode not in ("restock", "check"):
            raise ValueError("mode must be restock or check")
        if decision not in ("ACCEPT", "REVIEW", "REFUSE"):
            raise ValueError("decision must be ACCEPT, REVIEW or REFUSE")
        if decision == "ACCEPT" and not product_name.strip():
            raise ValueError("productName is required for ACCEPT")
        if person_answer not in ("", "yes", "no"):
            raise ValueError("personAnswer must be yes, no or empty")
        if not (1 <= int(quantity) <= 1000) or not (1 <= int(attempts) <= 3) or seconds < 0:
            raise ValueError("quantity 1-1000, attempts 1-3, seconds >= 0")
        if not self.device_id:
            raise ValueError("unknown deviceId: ping or fetch the snapshot once first")
        f = {k: (fields or {}).get(k) or field("", "not_found") for k in ("batch", "mfd", "exp", "mrp")}
        for k, v in f.items():
            if v.get("status") not in FIELD_STATUSES:
                raise ValueError(f"fields.{k}.status is not valid")
        if decision == "ACCEPT" and mode == "restock":  # the server would downgrade these to REVIEW; warn early
            for k, rx in (("mfd", YM_RE), ("exp", YM_RE), ("mrp", MRP_RE)):
                if f[k]["status"] in ("confirmed", "read") and not rx.match(f[k]["value"]):
                    log.warning("fields.%s=%r is not in the right format; the server will save this as REVIEW", k, f[k]["value"])
        now_local = dt.datetime.now(dt.timezone.utc).astimezone()
        return {
            "eventId": str(uuid.uuid4()),
            "deviceId": self.device_id,
            "time": now_local.isoformat(timespec="seconds"),
            "mode": mode,
            "productId": product_id,
            "productName": product_name.strip()[:200],
            "fields": f,
            "matchedMaster": bool(matched_master),
            "decision": decision,
            "reason": reason[:500],
            "personAnswer": person_answer,
            "quantity": int(quantity),
            "sold": bool(sold),
            "attempts": int(attempts),
            "seconds": round(float(seconds), 2),
            "softwareVersion": self.software_version[:40],
        }

    def enqueue(self, event: dict) -> None:
        """Save the scan locally. Call this BEFORE showing the result on screen."""
        with self.db:
            self.db.execute("insert or ignore into events (event_id, body, created_at) values (?, ?, ?)",
                            (event["eventId"], json.dumps(event), time.time()))

    def counts(self) -> dict:
        rows = dict(self.db.execute("select status, count(*) from events group by status").fetchall())
        return {"pending": rows.get("pending", 0), "done": rows.get("done", 0), "failed": rows.get("failed", 0)}

    def failed(self, limit: int = 20) -> list[tuple[str, str]]:
        return self.db.execute("select event_id, error from events where status='failed' order by created_at desc limit ?", (limit,)).fetchall()

    def upload_pending(self) -> dict:
        """Uploads due events, oldest first, 100 at a time. Returns counts. Raises KeyRejected on 401."""
        summary = {"saved": 0, "duplicate": 0, "rejected": 0, "retry_later": 0}
        while True:
            rows = self.db.execute("select event_id, body, attempts from events where status='pending' and next_try <= ? "
                                   "order by created_at limit ?", (time.time(), MAX_BATCH)).fetchall()
            if not rows:
                return summary
            events = [json.loads(r[1]) for r in rows]
            try:
                status, body = self._request("POST", "/api/device/events", {"events": events})
            except NetworkError as e:
                with self.db:
                    for event_id, _, attempts in rows:
                        wait = BACKOFF_SECONDS[min(attempts, len(BACKOFF_SECONDS) - 1)]
                        self.db.execute("update events set attempts=attempts+1, next_try=?, error=? where event_id=?",
                                        (time.time() + wait, f"network: {e}", event_id))
                summary["retry_later"] += len(rows)
                return summary
            if status == 401:
                raise KeyRejected("Device key rejected - contact Farmacia Tech")
            if status == 400:  # the request itself was malformed: a bug in the device software
                with self.db:
                    for event_id, _, _ in rows:
                        self.db.execute("update events set status='failed', error=? where event_id=?", (f"HTTP 400: {body}", event_id))
                log.error("Server refused the request (HTTP 400): %s", body)
                summary["rejected"] += len(rows)
                continue
            results = {r.get("eventId"): r for r in (body or {}).get("results", [])}
            with self.db:
                for event_id, _, _ in rows:
                    r = results.get(event_id)
                    if r is None:
                        continue  # not answered: stays pending
                    if r["status"] in ("saved", "duplicate"):
                        self.db.execute("update events set status='done', error=null where event_id=?", (event_id,))
                        summary[r["status"]] += 1
                    else:
                        self.db.execute("update events set status='failed', error=? where event_id=?", (r.get("error", "rejected"), event_id))
                        summary["rejected"] += 1
            self._meta_set("last_sync", str(time.time()))

    # ---- loop ----
    def run_forever(self, on_status=None) -> None:
        """Ping every pollSeconds; download the snapshot when its version changes; upload the queue.
        on_status(dict) is called after each round (e.g. to show 'Last synced' / 'Pending uploads')."""
        failures = 0
        while True:
            try:
                p = self.ping()
                if p.get("snapshotVersion") != (self.cached_snapshot() or {}).get("snapshotVersion"):
                    self.fetch_snapshot()
                self.upload_pending()
                failures = 0
                wait = self.poll_seconds
            except NetworkError as e:
                failures += 1
                wait = BACKOFF_SECONDS[min(failures - 1, len(BACKOFF_SECONDS) - 1)]
                log.info("offline (%s); retrying in %ss", e, wait)
            if on_status:
                on_status({**self.counts(), "last_sync": self._meta_get("last_sync"), "online": failures == 0})
            time.sleep(wait)

    def _meta_set(self, k: str, v: str) -> None:
        with self.db:
            self.db.execute("insert into meta (k, v) values (?, ?) on conflict(k) do update set v=excluded.v", (k, v))

    def _meta_get(self, k: str) -> Optional[str]:
        row = self.db.execute("select v from meta where k=?", (k,)).fetchone()
        return row[0] if row else None


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------
def _load_config(args) -> tuple[str, str]:
    url, key = args.url or os.environ.get("FT_URL"), args.key or os.environ.get("FT_DEVICE_KEY")
    if args.config and os.path.exists(args.config):
        mode = os.stat(args.config).st_mode
        if mode & (stat.S_IRWXG | stat.S_IRWXO):
            log.warning("%s can be read by other users; run: chmod 600 %s", args.config, args.config)
        with open(args.config) as f:
            cfg = json.load(f)
        url, key = url or cfg.get("baseUrl"), key or cfg.get("deviceKey")
    if not url or not key:
        sys.exit("Need baseUrl and deviceKey: use --config config.json, or --url and --key, or FT_URL / FT_DEVICE_KEY.")
    return url, key


def main() -> None:
    ap = argparse.ArgumentParser(description="Farmacia Tech device client (modules/5-devices/device-api.md v1.3)")
    ap.add_argument("command", choices=["health", "ping", "snapshot", "pair", "selftest", "upload", "status", "run"])
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--url")
    ap.add_argument("--key")
    ap.add_argument("--data", default="ft-data", help="folder for snapshot.json and queue.db")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    url, key = _load_config(args)
    c = DeviceClient(url, key, args.data)

    try:
        if args.command == "health":
            h = c.health()
            print(f"OK · server {url} · API {h.get('api')} · server time {h.get('serverTime')} · clock offset {c.clock_offset:+.1f}s")
        elif args.command == "ping":
            p = c.ping()
            print(f"Key OK · device {p['deviceId']} ({p.get('name')}) · snapshot version {p['snapshotVersion']} · poll every {p['pollSeconds']}s")
        elif args.command == "snapshot":
            s = c.fetch_snapshot()
            print(f"Saved {args.data}/snapshot.json · device {s['device']['deviceId']} · version {s.get('snapshotVersion')} · "
                  f"{len(s['products'])} medicines · {len(s['batches'])} confirmed batches · {len(s['recalls'])} recalls · {len(s['stock'])} stock rows")
        elif args.command == "pair":
            p = c.request_pairing_code()
            until = dt.datetime.fromisoformat(p["expiresAt"].replace("Z", "+00:00")).astimezone().strftime("%H:%M")
            if p.get("linked"):
                print("Note: this device is already linked. This code lets another operator take it over.")
            print(f"Device ID     {p['deviceId']}\nPairing code  {p['pairingCode']}   (valid until {until}, works once)")
            print("On the website: My devices → Link a device, then type both.")
        elif args.command == "selftest":
            if not c.device_id:
                c.ping()
            e = c.make_event("check", "REFUSE", reason="Self-test from the reference client (safe to ignore)",
                             fields={"batch": field("SELFTEST-1", "read")})
            c.enqueue(e)
            print("Queued one self-test scan (check / REFUSE: it only appears in the reject bin).")
            print("Upload:", c.upload_pending())
        elif args.command == "upload":
            print("Upload:", c.upload_pending())
        elif args.command == "status":
            last = c._meta_get("last_sync")
            when = dt.datetime.fromtimestamp(float(last)).strftime("%d %b %Y %H:%M") if last else "never"
            print("Queue:", c.counts(), "· last sync:", when)
            for event_id, error in c.failed():
                print(f"  failed {event_id}: {error}")
        elif args.command == "run":
            c.run_forever(on_status=lambda st: log.info("pending %(pending)s · failed %(failed)s · online %(online)s", st))
    except KeyRejected as e:
        sys.exit(f"✗ {e}")
    except NetworkError as e:
        sys.exit(f"✗ Can't reach {url}: {e}")


if __name__ == "__main__":
    main()
