import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value = 0) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function truncateText(value: string | null | undefined, max = 90) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
