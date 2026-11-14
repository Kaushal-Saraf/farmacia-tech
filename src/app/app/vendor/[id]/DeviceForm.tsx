"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
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

export function DeviceForm({ device, unit }: { device: Device; unit: string }) {
  const [state, action, pending] = useActionState<DeviceFormState, FormData>(updateDevice, {});
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
      <label className="text-sm font-medium text-ink">
        Latitude <span className="font-normal text-muted">(optional)</span>
        <input name="latitude" inputMode="decimal" defaultValue={device.latitude ?? ""} className={inputClass} placeholder="28.6692" />
      </label>
      <label className="text-sm font-medium text-ink">
        Longitude <span className="font-normal text-muted">(optional)</span>
        <input name="longitude" inputMode="decimal" defaultValue={device.longitude ?? ""} className={inputClass} placeholder="77.4538" />
      </label>
      <p className="-mt-2 text-xs text-muted sm:col-span-2">Tip: in Google Maps, right-click the spot and click the coordinates to copy them.</p>
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
