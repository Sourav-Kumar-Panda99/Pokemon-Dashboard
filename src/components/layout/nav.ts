import {
  Backpack,
  BadgeDollarSign,
  Banknote,
  Bot,
  ClipboardList,
  Clock,
  History,
  Hourglass,
  House,
  Package,
  PackageCheck,
  Plus,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip */
  accent: string;
  /** Badge counter key (filled from server stats) */
  counter?: "pending" | "total" | "unsold" | "sold";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavSection[] = [
  {
    items: [{ href: "/admin", label: "Dashboard", icon: House, accent: "text-sky-300 bg-sky-400/10" }],
  },
  {
    title: "Inventory",
    items: [
      { href: "/admin/accounts", label: "All Accounts", icon: Backpack, accent: "text-yellow-300 bg-yellow-400/10", counter: "total" },
      { href: "/admin/accounts?type=NEW", label: "New IDs", icon: Sparkles, accent: "text-sky-300 bg-sky-400/10" },
      { href: "/admin/accounts?type=BOT", label: "Bot IDs", icon: Bot, accent: "text-violet-300 bg-violet-400/10" },
      { href: "/admin/accounts?type=OLD", label: "Old IDs", icon: Clock, accent: "text-amber-300 bg-amber-400/10" },
      { href: "/admin/accounts?status=SOLD", label: "Sold", icon: BadgeDollarSign, accent: "text-rose-300 bg-rose-400/10" },
      { href: "/admin/accounts?status=UNSOLD", label: "Unsold", icon: Package, accent: "text-emerald-300 bg-emerald-400/10" },
      { href: "/admin/pending", label: "Pending Review", icon: Hourglass, accent: "text-yellow-300 bg-yellow-400/10", counter: "pending" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/admin/users", label: "Submitters", icon: Users, accent: "text-cyan-300 bg-cyan-400/10" },
      { href: "/admin/sales", label: "Sales", icon: Banknote, accent: "text-green-300 bg-green-400/10" },
      { href: "/admin/activity", label: "Activity Logs", icon: ClipboardList, accent: "text-indigo-300 bg-indigo-400/10" },
      { href: "/admin/settings", label: "Settings", icon: Settings, accent: "text-slate-300 bg-slate-400/10" },
    ],
  },
];

export const SUBMITTER_NAV: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "My Dashboard", icon: House, accent: "text-sky-300 bg-sky-400/10", counter: "total" },
      { href: "/dashboard/submit", label: "Submit Account", icon: Plus, accent: "text-yellow-300 bg-yellow-400/10" },
    ],
  },
  {
    title: "My Submissions",
    items: [
      { href: "/dashboard?status=PENDING", label: "Pending Review", icon: Hourglass, accent: "text-yellow-300 bg-yellow-400/10", counter: "pending" },
      { href: "/dashboard?status=UNSOLD", label: "Unsold", icon: Package, accent: "text-emerald-300 bg-emerald-400/10" },
      { href: "/dashboard?status=SOLD", label: "Sold", icon: PackageCheck, accent: "text-rose-300 bg-rose-400/10" },
      { href: "/dashboard/history", label: "Submission History", icon: History, accent: "text-indigo-300 bg-indigo-400/10" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, accent: "text-slate-300 bg-slate-400/10" }],
  },
];
