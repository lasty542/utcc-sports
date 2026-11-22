/**
 * ยูทิลิตีและการแปลงข้อมูลสำหรับหน้าต่างขอยืมอุปกรณ์ (BorrowModal)
 */

export const TIME_SLOTS = [
  { value: 'morning', label: 'เช้า (09:00 - 12:00 น.)', short: '09:00 - 12:00 น.' },
  { value: 'afternoon', label: 'บ่าย (13:00 - 16:30 น.)', short: '13:00 - 16:30 น.' },
  { value: 'evening', label: 'เย็น (16:30 - 19:00 น.)', short: '16:30 - 19:00 น.' },
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number]['value'];

export const PURPOSE_OPTIONS = [
  'เล่นกีฬา / ออกกำลังกาย',
  'ฝึกซ้อมชมรมกีฬา',
  'กิจกรรมคณะ / แข่งขัน',
  'อื่นๆ (ระบุเอง)',
] as const;

export type PurposeOption = (typeof PURPOSE_OPTIONS)[number];

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatThaiDate(isoDate: string): string {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function calculateDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 1;
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  if (!y1 || !y2) return 1;
  const dStart = new Date(y1, m1 - 1, d1).getTime();
  const dEnd = new Date(y2, m2 - 1, d2).getTime();
  const diffDays = Math.round((dEnd - dStart) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays === 0 ? 1 : diffDays);
}
