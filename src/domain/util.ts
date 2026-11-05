export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** YYYY-MM-DD in local time */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DDTHH:mm in local time */
export function toISODateTime(d: Date): string {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDate(s: string): Date {
  // accepts YYYY-MM-DD or YYYY-MM-DDTHH:mm (local)
  const [datePart, timePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) return false;
  const d = parseDate(s);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s.slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + months);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function ageOn(dob: string, on: Date): number {
  const b = parseDate(dob);
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function formatMoney(n: number, currency = '£', compact = true): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (compact && v >= 1_000_000) return `${sign}${currency}${(v / 1_000_000).toFixed(2)}m`;
  if (compact && v >= 10_000) return `${sign}${currency}${Math.round(v / 1000)}k`;
  if (compact && v >= 1_000) return `${sign}${currency}${(v / 1000).toFixed(1)}k`;
  return `${sign}${currency}${Math.round(v).toLocaleString('en-GB')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(d: Date): string {
  return MONTHS[d.getMonth()];
}

export function formatDate(s: string, withTime = false): string {
  const d = parseDate(s);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let out = `${days[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (d.getFullYear() !== new Date().getFullYear()) out += ` ${d.getFullYear()}`;
  if (withTime && s.includes('T')) out += ` · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return out;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
