import {
  ArrowRightLeft,
  BadgeDollarSign,
  CircleCheck,
  CircleX,
  Download,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Pencil,
  Plus,
  Send,
  Shapes,
  Trash2,
  Undo2,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { ACTION_TONE } from "@/lib/activity";
import type { ActivityAction } from "@/lib/types";

const ICONS: Record<ActivityAction, LucideIcon> = {
  CREATED: Plus,
  SUBMITTED: Send,
  EDITED: Pencil,
  TYPE_CHANGED: Shapes,
  STATUS_CHANGED: ArrowRightLeft,
  APPROVED: CircleCheck,
  REJECTED: CircleX,
  MARKED_SOLD: BadgeDollarSign,
  MARKED_UNSOLD: Undo2,
  DELETED: Trash2,
  CREDENTIALS_UPDATED: KeyRound,
  CREDENTIALS_REVEALED: Eye,
  IMPORTED: FileSpreadsheet,
  EXPORTED: Download,
  USER_REGISTERED: UserPlus,
  USER_ROLE_CHANGED: UserCog,
  USER_DISABLED: UserX,
  USER_ENABLED: UserCheck,
};

export function ActivityIcon({ action, size = "md" }: { action: ActivityAction; size?: "sm" | "md" }) {
  const Icon = ICONS[action] ?? Pencil;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ring-1 ${ACTION_TONE[action]} ${size === "sm" ? "size-7" : "size-9"}`}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}
