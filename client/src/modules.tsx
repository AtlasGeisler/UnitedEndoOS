import {
  Sun,
  CalendarDays,
  ListChecks,
  Users,
  Stethoscope,
  GitPullRequestArrow,
  Contact,
  ClipboardSignature,
  CreditCard,
  MessageSquare,
  BarChart3,
  Gauge,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  section: "Practice" | "Clinical" | "Growth" | "Money" | "Insight" | "System";
  hotkey?: number; // Cmd+1..9
}

// The left sidebar order, exactly the module spec. Sections group the source
// list the way a Mac source list groups its rows.
export const MODULES: ModuleDef[] = [
  { key: "today", label: "Today", path: "/", icon: Sun, section: "Practice", hotkey: 1 },
  { key: "schedule", label: "Schedule", path: "/schedule", icon: CalendarDays, section: "Practice", hotkey: 2 },
  { key: "worklists", label: "Worklists", path: "/worklists", icon: ListChecks, section: "Practice", hotkey: 3 },
  { key: "patients", label: "Patients", path: "/patients", icon: Users, section: "Clinical", hotkey: 4 },
  { key: "clinical", label: "Clinical", path: "/clinical", icon: Stethoscope, section: "Clinical", hotkey: 5 },
  { key: "referrals", label: "Referrals", path: "/referrals", icon: GitPullRequestArrow, section: "Growth", hotkey: 6 },
  { key: "referring", label: "Referring Doctors", path: "/referring-doctors", icon: Contact, section: "Growth", hotkey: 7 },
  { key: "plans", label: "Plans", path: "/plans", icon: ClipboardSignature, section: "Growth" },
  { key: "billing", label: "Billing", path: "/billing", icon: CreditCard, section: "Money", hotkey: 8 },
  { key: "messages", label: "Messages", path: "/messages", icon: MessageSquare, section: "Money", hotkey: 9 },
  { key: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3, section: "Insight" },
  { key: "performance", label: "Performance", path: "/performance", icon: Gauge, section: "Insight" },
  { key: "operations", label: "Operations", path: "/operations", icon: Settings2, section: "System" },
  { key: "admin", label: "Admin", path: "/admin", icon: ShieldCheck, section: "System" },
];

export const SECTION_ORDER: ModuleDef["section"][] = [
  "Practice",
  "Clinical",
  "Growth",
  "Money",
  "Insight",
  "System",
];
