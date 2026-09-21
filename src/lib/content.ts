import {
  Stethoscope,
  CreditCard,
  QrCode,
  PackageCheck,
  ScanEye,
  Hand,
  ShieldCheck,
  Clock,
  BarChart3,
  CalendarClock,
  Lock,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export type Item = { icon: LucideIcon; title: string; body: string };

export const steps: Item[] = [
  {
    icon: Stethoscope,
    title: "Doctor prescribes",
    body: "A verified doctor issues a digital prescription from the Farmacia Tech portal. It's linked to the patient's phone number, not a paper slip.",
  },
  {
    icon: CreditCard,
    title: "Patient pays online",
    body: "The patient opens the prescription, picks a nearby machine that has every medicine in stock, and pays by UPI or card.",
  },
  {
    icon: QrCode,
    title: "Secure QR is issued",
    body: "A single-use QR code is generated for that order and that machine only. It expires if unused and can't be copied or reused.",
  },
  {
    icon: PackageCheck,
    title: "Machine dispenses",
    body: "At the machine, the patient scans the QR. The system checks it, picks the right packs from the right slots, and drops them in the tray.",
  },
];

export const features: Item[] = [
  {
    icon: ScanEye,
    title: "Vision-guided picking",
    body: "Cameras and computer vision confirm the right pack is picked from each slot before it's released.",
  },
  {
    icon: Hand,
    title: "Adaptive grasping",
    body: "A compliant gripper handles strips, boxes and bottles of different sizes without damaging them.",
  },
  {
    icon: ShieldCheck,
    title: "Prescription-first",
    body: "Prescription medicines are only released against a valid e-prescription from a verified doctor.",
  },
  {
    icon: Clock,
    title: "Available 24×7",
    body: "Patients can collect medicines after the pharmacy counter closes, at night, on weekends and on holidays.",
  },
  {
    icon: BarChart3,
    title: "Live inventory",
    body: "Operators see stock per slot in real time, with alerts before a medicine runs out.",
  },
  {
    icon: CalendarClock,
    title: "Expiry tracking",
    body: "Every batch is tracked by expiry date, and expired stock is automatically locked from sale.",
  },
];

export const trust: Item[] = [
  {
    icon: Lock,
    title: "Privacy by design",
    body: "Health data is encrypted, stored in India and visible only to the patient and their doctor. We never ask for Aadhaar.",
  },
  {
    icon: ShieldCheck,
    title: "Verified prescribers",
    body: "Doctors are verified against their medical registration number before they can prescribe on the platform.",
  },
  {
    icon: MapPin,
    title: "Built for India",
    body: "UPI payments, phone-number login and machines designed for hospitals, campuses and residential communities.",
  },
];
