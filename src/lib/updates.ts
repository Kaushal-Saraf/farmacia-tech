// Add new posts at the top. `date` is shown as-is.
export type Update = { date: string; tag: string; title: string; body: string };

export const updates: Update[] = [
  {
    date: "September 2026",
    tag: "Platform",
    title: "The new Farmacia Tech platform is live",
    body: "We rebuilt our website and prescription platform from the ground up, with phone-number sign-in, verified doctors, database-level privacy controls and a portal for machine operators.",
  },
  {
    date: "2026",
    tag: "Robotics",
    title: "Vision-guided picking and adaptive grasping",
    body: "Our next-generation machine adds camera-based pack verification and a compliant gripper that handles strips, boxes and bottles safely.",
  },
  {
    date: "2024",
    tag: "Prototype",
    title: "First working prototype",
    body: "An ESP32-based machine with a QR scanner and motorised slots, connected to a web platform for doctors, patients and vendors, proved the end-to-end flow.",
  },
];
