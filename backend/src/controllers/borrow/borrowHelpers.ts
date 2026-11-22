/**
 * โมดูลข้อมูลโครงสร้างและฟังก์ชันช่วยเหลือสำหรับระบบยืม-คืนอุปกรณ์
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pool } from '../../config/db';

export type BorrowStatusDb = 'pending' | 'approved' | 'borrowing' | 'borrowed' | 'returned';

export interface BorrowRow {
  id: number;
  user_id: number;
  equipment_id: number;
  student_id: string;
  user_name: string;
  equipment: string;
  quantity: number;
  purpose: string | null;
  borrow_date: string;
  due_date: string;
  status: BorrowStatusDb;
  item_codes: string[] | null;
  is_overdue: boolean;
}

// แปลงแถวข้อมูลการยืมจากฐานข้อมูลพร้อมคำนวณสถานะเกินกำหนด
export function toBorrow(row: BorrowRow) {
  const isBorrowing = row.status === 'borrowing' || row.status === 'borrowed';
  const overdue = isBorrowing && row.is_overdue;
  const statusType = overdue
    ? 'overdue'
    : row.status === 'borrowed'
    ? 'borrowing'
    : row.status === 'approved'
    ? 'pending'
    : row.status;

  let statusLabel = 'กำลังยืม';
  if (overdue) statusLabel = 'เกินกำหนดส่งคืน';
  else if (row.status === 'pending' || row.status === 'approved') statusLabel = 'รออนุมัติรับอุปกรณ์';
  else if (row.status === 'returned') statusLabel = 'คืนเรียบร้อยแล้ว';

  const codes = Array.isArray(row.item_codes) ? row.item_codes : [];

  return {
    id: row.id,
    userId: row.user_id,
    studentId: row.student_id,
    userName: row.user_name,
    equipmentId: row.equipment_id,
    equipment: row.equipment,
    qty: row.quantity,
    purpose: row.purpose,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    status: statusLabel,
    statusType,
    itemCodes: codes,
    itemCodeLabel: codes.length > 0 ? codes.join(', ') : '-',
  };
}

export function getQrSigningSecret(): string {
  return process.env.JWT_SECRET || 'utcc-sports-qr-fallback-secret';
}

export function signQrPayload(subject: string, borrowId: number, step: number): string {
  return createHmac('sha256', getQrSigningSecret())
    .update(`utcc-qr:${subject}:${borrowId}:${step}`)
    .digest('hex')
    .slice(0, 16);
}

export function verifySignature(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actual, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function derive6DigitPin(sigHex: string): string {
  const numeric = Number.parseInt(sigHex.slice(0, 8), 16) % 1_000_000;
  return String(numeric).padStart(6, '0');
}

export const BORROW_SELECT = `
  SELECT
    b.id,
    b.user_id,
    b.equipment_id,
    u.student_id,
    u.name AS user_name,
    e.name AS equipment,
    COALESCE(b.quantity, 1)::int AS quantity,
    b.purpose,
    COALESCE(b.borrow_date::text, CURRENT_DATE::text) AS borrow_date,
    COALESCE(b.due_date::text, b.return_date::text, (CURRENT_DATE + INTERVAL '1 day')::date::text) AS due_date,
    b.status,
    COALESCE(b.item_codes, ARRAY[]::text[]) AS item_codes,
    (b.status IN ('borrowing', 'borrowed') AND COALESCE(b.due_date, b.return_date, CURRENT_DATE) < CURRENT_DATE) AS is_overdue
  FROM borrows b
  JOIN users u ON u.id = b.user_id
  JOIN equipment e ON e.id = b.equipment_id
`;

// ซิงค์ available_qty และสถานะ equipment โดยใช้ตรรกะ LEAST(total_qty, ...)
export async function refreshEquipmentStatus(
  client: { query: typeof pool.query },
  equipmentId: number
): Promise<void> {
  await client.query(
    `UPDATE equipment
     SET available_qty = LEAST(total_qty, GREATEST(0, available_qty)),
         status = CASE
           WHEN available_qty >= total_qty THEN 'พร้อมใช้งาน'
           ELSE 'ใช้งานอยู่'
         END
     WHERE id = $1`,
    [equipmentId]
  );
}
