export const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

export const formatDateTime = (value: string) => new Date(value).toLocaleString();

export const formatTime12Hour = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
};

export const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toTextOrNull = (value: string) => value.trim() || null;
