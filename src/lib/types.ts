export type Role = "patient" | "doctor" | "vendor" | "admin";

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
};

// ---------- Vendor devices & medicine master (supabase/vendor-devices.sql) ----------
export type DeviceType = "vending" | "checker";
export type BatchSource = "confirmed_on_device" | "confirmed_on_website" | "unverified";
export type ScanMode = "restock" | "check";
export type ScanDecision = "ACCEPT" | "REVIEW" | "REFUSE";
export type ReviewStatus = "none" | "open" | "confirmed" | "corrected" | "deleted";
export type FieldStatus = "confirmed" | "read" | "from_record" | "not_found";
export type LockReason = "recalled" | "expired" | "not_confirmed";

/** One row of the stock_status view. mfd/exp are "YYYY-MM", mrp is "140.70". */
export type StockRow = {
  id: string;
  machine_id: string;
  device_type: DeviceType;
  device_code: string;
  device_name: string;
  low_stock_at: number;
  product_id: string;
  product_name: string;
  strength: string | null;
  manufacturer: string | null;
  pack_size: string | null;
  batch_id: string;
  batch_code: string;
  mfd: string | null;
  exp: string | null;
  mrp: string | null;
  source: BatchSource;
  not_confirmed: boolean;
  quantity: number;
  slot_no: number | null;
  shelf: string | null;
  updated_at: string;
  expires_on: string | null;
  days_left: number | null;
  lock_reason: LockReason | null;
};

// ---------- Family members on one mobile number (supabase/family.sql) ----------
export type Relation = "self" | "spouse" | "son" | "daughter" | "father" | "mother" | "other";
export type Gender = "male" | "female" | "other";

export type FamilyMember = {
  id: string;
  full_name: string;
  relation: Relation;
  birth_date: string | null; // YYYY-MM-DD
  gender: Gender | null;
};
