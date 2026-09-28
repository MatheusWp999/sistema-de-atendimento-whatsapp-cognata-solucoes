import { cn } from "@/lib/utils";

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: "green" | "amber" | "red" | "blue" | "slate" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "amber" && "bg-amber-100 text-amber-900",
        tone === "red" && "bg-red-100 text-red-800",
        tone === "blue" && "bg-blue-100 text-blue-800",
        tone === "slate" && "bg-slate-100 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}
