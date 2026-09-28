"use client";

import { Bot, Hand } from "lucide-react";

export function AIToggleButton({
  mode,
  onTakeover,
  onReturnToAI,
  disabled,
}: {
  mode: "AI" | "HUMAN";
  onTakeover: () => void;
  onReturnToAI: () => void;
  disabled?: boolean;
}) {
  if (mode === "AI") {
    return (
      <button
        onClick={onTakeover}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
      >
        <Hand size={16} /> Assumir conversa
      </button>
    );
  }

  return (
    <button
      onClick={onReturnToAI}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
    >
      <Bot size={16} /> Devolver para IA
    </button>
  );
}
