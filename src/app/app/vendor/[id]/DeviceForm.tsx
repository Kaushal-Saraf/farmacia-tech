"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Loader2, LocateFixed } from "lucide-react";
import { Button } from "@/components/Button";
import { updateDevice, type DeviceFormState } from "../actions";
import { inputClass } from "../../ui";

type Device = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  low_stock_at: number;
};

type Geo = { status: "idle" | "locating" | "done" | "error"; message?: string };

/** The operator sets the device's name and location. "Use my current location" fills the coordinates. */
export function DeviceForm({ device, unit }: { device: Device; unit: string }) {
  const [state, action, pending] = useActionState<DeviceFormState, FormData>(updateDevice, {});
  const [lat, setLat] = useState(device.latitude?.toString() ?? "");
  const [lng, setLng] = useState(device.longitude?.toString() ?? "");
  const [geo, setGeo] = useState<Geo>({ status: "idle" });

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "error", message: "This browser can't share its location. Type the coordinates instead." });
      return;
    }
    setGeo({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeo({ status: "done", message: `Found, accurate to about ${Math.round(pos.coords.accuracy)} m. Check it on the map, then press Save.` });
      },
      (err) =>
        setGeo({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was refused. Allow location for this site in your browser settings and try again, or type the coordinates."
              : err.code === err.TIMEOUT
                ? "Finding your location took too long. Try again, ideally near a window or outdoors."
                : "Couldn't find your location. Try again, or type the coordinates.",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const mapUrl = lat && lng ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}` : null;

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="machine_id" value={device.id} />
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Name
        <input name="name" required maxLength={80} defaultValue={device.name} className={inputClass} placeholder="City Pharmacy, front counter" />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Address
        <input name="address" maxLength={200} defaultValue={device.address ?? ""} className={inputClass} placeholder="Shop no., street, area, city" />
      </label>

      <div className="rounded-xl bg-surface p-4 ring-1 ring-line sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Map location</p>
            <p className="text-xs text-muted">Stand next to the device and press the button on your phone. Your browser will ask for permission.</p>
          </div>
          <Button type="button" variant="secondary" onClick={locate} disabled={geo.status === "locating"} className="px-4 py-2.5">
            {geo.status === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {geo.status === "locating" ? "Finding location…" : "Use my current location"}
          </Button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">
            Latitude
            <input name="latitude" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} placeholder="28.669200" />
          </label>
          <label className="text-xs font-medium text-muted">
            Longitude
            <input name="longitude" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} placeholder="77.453800" />
          </label>
        </div>
        {geo.message && (
          <p role={geo.status === "error" ? "alert" : "status"} className={`mt-3 text-sm ${geo.status === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {geo.message}
          </p>
        )}
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            Check on Google Maps <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <label className="text-sm font-medium text-ink">
        Low-stock alert at
        <div className="relative">
          <input name="low_stock_at" type="number" min={0} max={1000} required defaultValue={device.low_stock_at} className={`${inputClass} pr-20`} />
          <span className="pointer-events-none absolute right-4 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-muted">{unit}</span>
        </div>
        <span className="mt-1 block text-xs font-normal text-muted">Warn when a medicine has this many or fewer left on this device.</span>
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !pending && <p className="text-sm font-medium text-brand-700">{state.ok}</p>}
      </div>
    </form>
  );
}
