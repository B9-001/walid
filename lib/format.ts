// Shared display helpers — money is stored in KOBO (₦ × 100).

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

export function formatNaira(kobo: number, opts?: { showZero?: boolean }): string {
  if (!kobo || kobo <= 0) return opts?.showZero ? "₦0" : "₦0";
  const naira = kobo / 100;
  return "₦" + naira.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
