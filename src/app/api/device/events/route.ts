import { deviceDb, deviceKey, json, notConfigured, unauthorised } from "@/lib/device-api";

const MAX_EVENTS = 100;
const MAX_BYTES = 1_000_000;

/**
 * POST /api/device/events — upload scan events (modules/5-devices/device-api.md §4–5).
 * Header: X-Device-Key. Body: { "events": [ … up to 100 … ] }.
 * Each event is checked and saved on its own; the same eventId twice is saved once.
 */
export async function POST(request: Request) {
  const key = deviceKey(request);
  if (!key) return unauthorised();
  const db = deviceDb();
  if (!db) return notConfigured();

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: "Body is larger than 1 MB" }, 400);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Body is not valid JSON" }, 400);
  }
  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events)) return json({ error: 'Body must be { "events": [ … ] }' }, 400);
  if (events.length > MAX_EVENTS) return json({ error: `At most ${MAX_EVENTS} events per request` }, 400);
  if (events.length === 0) return json({ results: [] });

  const { data, error } = await db.rpc("device_ingest_events", { p_key: key, p_events: events });
  if (error) {
    console.error("[device/events]", error.message);
    return json({ error: "Server error, try again later" }, 500);
  }
  if (!data) return unauthorised();
  return json(data);
}
