// Shared display helpers — money is stored in KOBO (₦ × 100).

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  // Postgres unique-constraint violations surface as a raw, technical message
  // (e.g. "duplicate key value violates unique constraint ..._product_id_key") —
  // translate the common one into something a non-technical admin can act on.
  if (/duplicate key value violates unique constraint/i.test(raw)) {
    return "That name is already used by another item — please choose a different name and try again.";
  }
  return raw || fallback;
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
