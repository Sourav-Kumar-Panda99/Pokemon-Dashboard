"use client";

import { CircleCheck } from "lucide-react";
import { useAccountActions } from "./useAccountActions";

/** Approves every listed sale at once (asks first when there is more than one). */
export function ApproveSalesButton({ ids }: { ids: number[] }) {
  const { request, dialog, pending } = useAccountActions({ role: "ADMIN" });
  if (ids.length === 0) return null;
  return (
    <>
      <button type="button" className="btn btn-success" disabled={pending} onClick={() => request("APPROVE_SALE", ids)}>
        <CircleCheck className="size-4" /> Approve {ids.length === 1 ? "this sale" : `all ${ids.length} on this page`}
      </button>
      {dialog}
    </>
  );
}
