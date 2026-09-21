// Machine specifications shown on /machine. Edit these to match your final hardware.
export const machineSpecs: { label: string; value: string }[] = [
  { label: "Storage", value: "Modular slot trays, configurable per site" },
  { label: "Pack types", value: "Strips, boxes and bottles" },
  { label: "Picking", value: "Motorised slots + compliant gripper" },
  { label: "Verification", value: "Camera-based QR scan and pack check" },
  { label: "Controller", value: "ESP32-based, authenticated device keys" },
  { label: "Connectivity", value: "Wi-Fi or 4G" },
  { label: "Payments", value: "Online (UPI, cards). No cash handling" },
  { label: "Power", value: "Standard 230 V AC" },
];

export const installSteps = [
  { title: "Site survey", body: "We check footfall, power, network and floor space with you." },
  { title: "Medicine mix", body: "Together we pick the medicines to stock, based on prescriptions at your site." },
  { title: "Installation", body: "We install, configure the slots and connect the machine to your dashboard." },
  { title: "Training", body: "Your team learns restocking and the dashboard in a short session." },
  { title: "Go live", body: "Doctors start prescribing and patients start collecting. We monitor and support." },
];
