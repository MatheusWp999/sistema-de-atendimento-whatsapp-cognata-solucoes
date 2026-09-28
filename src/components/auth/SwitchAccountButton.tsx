"use client";

import { LogOut } from "lucide-react";

export function SwitchAccountButton() {
  async function switchAccount() {
    await Promise.all([
      fetch("/api/auth/company", { method: "DELETE" }).catch(() => undefined),
      fetch("/api/auth/admin", { method: "DELETE" }).catch(() => undefined),
    ]);
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={switchAccount} className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800">
      <LogOut size={16} /> Trocar conta
    </button>
  );
}
