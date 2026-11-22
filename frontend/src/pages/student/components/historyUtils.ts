import type { BorrowItem } from '../../../services/borrowService';

export type StatusFilter = 'all' | 'borrowing' | 'pending' | 'returned' | 'overdue';

export const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'borrowing', label: 'กำลังยืม' },
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'returned', label: 'คืนแล้ว' },
  { key: 'overdue', label: 'เกินกำหนด' },
];

// แปลงรหัสการยืมตัวเลขเป็นรูปแบบ REQ-0001
export function formatRequestCode(id: number): string {
  return `REQ-${String(id).padStart(4, '0')}`;
}

// แปลงวันที่ YYYY-MM-DD เป็นรูปแบบวันที่ภาษาไทยแบบย่อ
export function formatThaiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ปรับค่าสถานะให้เป็นคีย์มาตรฐานสำหรับใช้แบ่งแท็บและแสดงสี Badge
export function getNormalizedStatus(item: BorrowItem): Exclude<StatusFilter, 'all'> {
  const type = String(item.statusType).toLowerCase();
  if (type === 'pending' || item.status.includes('รออนุมัติ')) return 'pending';
  if (type === 'overdue') return 'overdue';
  if (type === 'returned') return 'returned';
  return 'borrowing';
}
