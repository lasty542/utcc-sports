/**
 * ตัวควบคุม (Controller) จัดการคำขอยืม-คืนอุปกรณ์, การสร้าง Dynamic QR/PIN และการยืนยันรับ-คืนผ่านสแกน
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { isDateString, readString } from '../utils';

type BorrowStatusDb = 'pending' | 'approved' | 'borrowing' | 'borrowed' | 'returned';

interface BorrowRow {
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

// แปลงข้อมูลการยืมจากฐานข้อมูลพร้อมคำนวณป้ายสถานะภาษาไทยและสถานะเกินกำหนดคืน
function toBorrow(row: BorrowRow) {
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

// ดึงคีย์ลับสำหรับลงลายเซ็น HMAC บน Dynamic QR Code
function getQrSigningSecret(): string {
  return process.env.JWT_SECRET || 'utcc-sports-qr-fallback-secret';
}

// สร้างลายเซ็น HMAC-SHA256 แบบสั้นสำหรับป้องกันการปลอมแปลง QR Code
function signQrPayload(subject: string, borrowId: number, step: number): string {
  return createHmac('sha256', getQrSigningSecret())
    .update(`utcc-qr:${subject}:${borrowId}:${step}`)
    .digest('hex')
    .slice(0, 16);
}

// เปรียบเทียบลายเซ็น QR ด้วยวิธี Constant-time ป้องกัน Timing Attack
function verifySignature(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actual, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

// แปลงลายเซ็นเป็นรหัส PIN 6 หลักสำหรับแสดงใต้ QR Code
function derive6DigitPin(sigHex: string): string {
  const numeric = Number.parseInt(sigHex.slice(0, 8), 16) % 1_000_000;
  return String(numeric).padStart(6, '0');
}

const BORROW_SELECT = `
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

// ตรวจสอบโควตาการยืมและสถานะคงค้างของนักศึกษาปัจจุบัน
export async function getUserQuota(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  try {
    const summary = await pool.query<{
      current_items: number;
      current_requests: number;
      has_overdue: boolean;
    }>(
      `SELECT
         COALESCE(SUM(quantity), 0)::int AS current_items,
         COUNT(*)::int AS current_requests,
         COALESCE(BOOL_OR(COALESCE(due_date, return_date, CURRENT_DATE) < CURRENT_DATE), false) AS has_overdue
       FROM borrows
       WHERE user_id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed')`,
      [req.user.id]
    );

    const row = summary.rows[0] || { current_items: 0, current_requests: 0, has_overdue: false };
    const maxItems = 3;
    const maxRequests = 2;
    const currentItems = Number(row.current_items) || 0;
    const currentRequests = Number(row.current_requests) || 0;
    const hasOverdue = Boolean(row.has_overdue);

    res.json({
      maxItems,
      maxRequests,
      currentItems,
      currentRequests,
      remainingItems: Math.max(0, maxItems - currentItems),
      remainingRequests: Math.max(0, maxRequests - currentRequests),
      hasOverdue,
      canBorrow: !hasOverdue && currentItems < maxItems && currentRequests < maxRequests,
    });
  } catch (error: any) {
    console.error('Error in getUserQuota:', error);
    res.status(500).json({
      message: 'ไม่สามารถดึงข้อมูลโควตาได้',
      error: error?.message || String(error),
      detail: error?.detail,
    });
  }
}

// อัปเดตสถานะคลังอุปกรณ์ ("พร้อมใช้งาน" / "ใช้งานอยู่") ตามจำนวนคงเหลือจริง พร้อมกำกับยอดไม่ให้เกิน total_qty
async function refreshEquipmentStatus(client: { query: typeof pool.query }, equipmentId: number): Promise<void> {
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

// ดึงรายการยืม-คืนทั้งหมด (Admin เห็นทุกคน, นักศึกษาเห็นเฉพาะของตนเอง)
export async function listBorrows(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  try {
    const result = req.user.role === 'admin'
      ? await pool.query<BorrowRow>(`${BORROW_SELECT} ORDER BY b.id DESC`)
      : await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.user_id = $1 ORDER BY b.id DESC`, [req.user.id]);

    res.json({ borrows: result.rows.map(toBorrow) });
  } catch (error: any) {
    console.error('Error in listBorrows:', error);
    res.status(500).json({
      message: 'ไม่สามารถโหลดรายการยืมได้',
      error: error?.message || String(error),
      detail: error?.detail,
    });
  }
}

// สร้าง Dynamic QR Token และ PIN 6 หลักที่รีเฟรชทุก 30 วินาทีสำหรับรายการยืมของนักศึกษา
export async function getQrToken(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const requestedBorrowId = Number(req.query.borrowId);

  try {
    let targetBorrow: BorrowRow | undefined;

    if (Number.isInteger(requestedBorrowId) && requestedBorrowId > 0) {
      const specific = await pool.query<BorrowRow>(
        `${BORROW_SELECT}
         WHERE b.id = $1 AND b.user_id = $2 AND b.status IN ('pending', 'approved', 'borrowing', 'borrowed')`,
        [requestedBorrowId, req.user.id]
      );
      targetBorrow = specific.rows[0];
    }

    if (!targetBorrow) {
      const latestActive = await pool.query<BorrowRow>(
        `${BORROW_SELECT}
         WHERE b.user_id = $1 AND b.status IN ('pending', 'approved', 'borrowing', 'borrowed')
         ORDER BY b.id DESC
         LIMIT 1`,
        [req.user.id]
      );
      targetBorrow = latestActive.rows[0];
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const step = Math.floor(nowSec / 30);
    const secondsRemaining = 30 - (nowSec % 30);

    if (targetBorrow) {
      const sig = signQrPayload(String(req.user.id), targetBorrow.id, step);
      res.json({
        qrToken: `UTCC-PASS:${targetBorrow.id}:${step}:${sig}`,
        pin: derive6DigitPin(sig),
        step,
        secondsRemaining,
        borrow: toBorrow(targetBorrow),
      });
      return;
    }

    const sig = signQrPayload(req.user.studentId, 0, step);
    res.json({
      qrToken: `UTCC-ID:${req.user.studentId}:${step}:${sig}`,
      pin: derive6DigitPin(sig),
      step,
      secondsRemaining,
      borrow: null,
    });
  } catch (error: any) {
    console.error('Error in getQrToken:', error);
    res.status(500).json({
      message: 'ไม่สามารถสร้างรหัส QR ได้',
      error: error?.message || String(error),
      detail: error?.detail,
    });
  }
}

// สร้างคำขอยืมอุปกรณ์ใหม่ พร้อมตัดสต็อกและบันทึกสถานะ pending ภายใน Transaction
export async function createBorrow(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const equipmentId = Number(req.body?.equipmentId ?? req.body?.equipment_id);
  const quantity = Number(req.body?.quantity ?? req.body?.qty);
  const purpose = readString(req.body?.purpose);
  const rawBorrowDate = readString(req.body?.borrowDate ?? req.body?.borrow_date);
  const rawDueDate = readString(req.body?.dueDate ?? req.body?.due_date ?? req.body?.returnDate ?? req.body?.return_date);
  const timeSlot = readString(req.body?.timeSlot ?? req.body?.time_slot);

  const todayStr = new Date().toISOString().slice(0, 10);
  const borrowDate = isDateString(rawBorrowDate) ? rawBorrowDate : todayStr;
  const dueDate = isDateString(rawDueDate) ? rawDueDate : borrowDate;

  if (!Number.isInteger(equipmentId) || !Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ message: 'ระบุอุปกรณ์และจำนวนที่ต้องการยืมให้ถูกต้อง' });
    return;
  }

  if (dueDate < borrowDate) {
    res.status(400).json({ message: 'วันที่กำหนดส่งคืนต้องไม่ย้อนหลังกว่าวันที่รับอุปกรณ์' });
    return;
  }

  // 1. ตรวจสอบว่ามีรายการที่เลยกำหนดคืน (Overdue) หรือไม่
  const overdueCheck = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM borrows
     WHERE user_id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed')
       AND COALESCE(due_date, return_date, CURRENT_DATE) < CURRENT_DATE`,
    [req.user.id]
  );
  if ((overdueCheck.rows[0]?.count ?? 0) > 0) {
    res.status(400).json({
      message: 'คุณมีรายการอุปกรณ์ที่เกินกำหนดส่งคืน กรุณานำอุปกรณ์มาคืนที่เคาน์เตอร์ก่อนสร้างคำขอใหม่',
    });
    return;
  }

  // 2. ตรวจสอบโควตาการยืม (สูงสุด 3 ชิ้น และไม่เกิน 2 คำขอพร้อมกัน)
  const quotaCheck = await pool.query<{ current_items: number; current_requests: number }>(
    `SELECT
       COALESCE(SUM(quantity), 0)::int AS current_items,
       COUNT(*)::int AS current_requests
     FROM borrows
     WHERE user_id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed')`,
    [req.user.id]
  );
  const currentItems = quotaCheck.rows[0]?.current_items ?? 0;
  const currentRequests = quotaCheck.rows[0]?.current_requests ?? 0;

  if (currentRequests >= 2) {
    res.status(400).json({
      message: 'คุณมีคำขอยืมที่รอดำเนินการครบ 2 คำขอแล้ว (จำกัดสูงสุดไม่เกิน 2 คำขอพร้อมกัน)',
    });
    return;
  }

  if (currentItems + quantity > 3) {
    res.status(400).json({
      message: `โควตาการยืมไม่เพียงพอ (จำกัดสูงสุด 3 ชิ้น คุณกำลังยืม/รอรับอยู่ ${currentItems} ชิ้น จึงยืมได้อีกไม่เกิน ${Math.max(0, 3 - currentItems)} ชิ้น)`,
    });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ตรวจสอบและล็อกแถวอุปกรณ์
    const equipment = await client.query<{ id: number; total_qty: number; available_qty: number }>(
      'SELECT id, total_qty, available_qty FROM equipment WHERE id = $1 FOR UPDATE',
      [equipmentId]
    );
    const item = equipment.rows[0];

    if (!item) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    if (item.available_qty < quantity) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'จำนวนอุปกรณ์ไม่พอให้ยืม' });
      return;
    }

    // เลือกรหัสประจำชิ้น (Serial Items) ที่ว่างอยู่พร้อมล็อกแถว FOR UPDATE ป้องกันการแย่งชิ้นเดียวกัน
    let serialQuery = await client.query<{ id: number; item_code: string }>(
      `SELECT id, item_code
       FROM equipment_items
       WHERE equipment_id = $1 AND status = 'available'
       ORDER BY id ASC
       LIMIT $2
       FOR UPDATE`,
      [equipmentId, quantity]
    );

    // หาก serial items ในฐานข้อมูลยังไม่ครบ ให้สร้างเพิ่มอัตโนมัติทันที
    if (serialQuery.rows.length < quantity) {
      const targetCount = Math.max(item.total_qty || 10, quantity);
      for (let i = 1; i <= targetCount; i++) {
        const itemCode = `EQ-${String(equipmentId).padStart(3, '0')}-${String(i).padStart(2, '0')}`;
        await client.query(
          `INSERT INTO equipment_items (equipment_id, item_code, status)
           VALUES ($1, $2, 'available')
           ON CONFLICT (item_code) DO NOTHING`,
          [equipmentId, itemCode]
        );
      }
      serialQuery = await client.query<{ id: number; item_code: string }>(
        `SELECT id, item_code
         FROM equipment_items
         WHERE equipment_id = $1 AND status = 'available'
         ORDER BY id ASC
         LIMIT $2
         FOR UPDATE`,
        [equipmentId, quantity]
      );
    }

    const itemCodes = serialQuery.rows.map((r) => r.item_code);
    const itemIds = serialQuery.rows.map((r) => r.id);

    await client.query(
      'UPDATE equipment SET available_qty = GREATEST(0, LEAST(total_qty, available_qty - $1)) WHERE id = $2',
      [quantity, equipmentId]
    );
    await refreshEquipmentStatus(client, equipmentId);

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO borrows (user_id, equipment_id, quantity, purpose, borrow_date, due_date, return_date, time_slot, status, item_codes)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'pending', $8)
       RETURNING id`,
      [req.user.id, equipmentId, quantity, purpose || null, borrowDate, dueDate, timeSlot || null, itemCodes]
    );
    const borrowId = inserted.rows[0]?.id;

    // ผูกรหัสประจำชิ้นเข้ากับคำขอนี้
    if (itemIds.length > 0) {
      await client.query(
        `UPDATE equipment_items
         SET status = 'reserved', borrow_id = $1
         WHERE id = ANY($2::int[])`,
        [borrowId, itemIds]
      );
    }

    await client.query('COMMIT');

    const created = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [borrowId]);
    const borrow = created.rows[0];
    if (!borrow) {
      res.status(500).json({ message: 'บันทึกการยืมไม่สำเร็จ' });
      return;
    }

    res.status(201).json({ borrow: toBorrow(borrow) });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in createBorrow:', error);
    res.status(500).json({
      message: 'ไม่สามารถบันทึกการยืมได้',
      error: error?.message || String(error),
      code: error?.code,
      table: error?.table,
      detail: error?.detail,
    });
  } finally {
    client.release();
  }
}

// ยืนยันการรับอุปกรณ์ด้วยตนเอง (เปลี่ยนสถานะจาก pending เป็น borrowing)
export async function confirmPickup(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสรายการยืมไม่ถูกต้อง' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{
      id: number;
      user_id: number;
      status: BorrowStatusDb;
      owner_student_id?: string;
    }>(
      `SELECT b.id, b.user_id, b.status, u.student_id AS owner_student_id
       FROM borrows b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1
       FOR UPDATE`,
      [id]
    );
    const borrow = existing.rows[0];

    if (!borrow) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'ไม่พบรายการยืม' });
      return;
    }

    const isOwner =
      Number(borrow.user_id) === Number(req.user.id) ||
      (Boolean(borrow.owner_student_id) &&
        String(borrow.owner_student_id).trim() === String(req.user.studentId).trim());
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      await client.query('ROLLBACK');
      res.status(403).json({ message: 'ไม่มีสิทธิ์ยืนยันรายการนี้ (เฉพาะเจ้าของคำขอหรือแอดมินเท่านั้น)' });
      return;
    }

    if (borrow.status !== 'pending' && borrow.status !== 'approved') {
      await client.query('ROLLBACK');
      res.status(409).json({
        message: borrow.status === 'returned' ? 'รายการนี้คืนแล้ว' : 'รายการนี้ยืนยันรับอุปกรณ์แล้ว (กำลังยืม)',
      });
      return;
    }

    await client.query(`UPDATE borrows SET status = 'borrowing' WHERE id = $1`, [borrow.id]);
    await client.query(
      `UPDATE equipment_items
       SET status = 'borrowed'
       WHERE borrow_id = $1 AND status != 'damaged'`,
      [borrow.id]
    );
    await client.query('COMMIT');

    const updated = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [borrow.id]);
    const row = updated.rows[0];
    if (!row) {
      res.status(500).json({ message: 'อัปเดตสถานะไม่สำเร็จ' });
      return;
    }

    res.json({
      message: `ยืนยันรับอุปกรณ์ "${row.equipment}" เรียบร้อยแล้ว (สถานะ: กำลังยืม)`,
      borrow: toBorrow(row),
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in confirmPickup:', error);
    res.status(500).json({
      message: 'ไม่สามารถยืนยันรับอุปกรณ์ได้',
      error: error?.message || String(error),
      code: error?.code,
      detail: error?.detail,
    });
  } finally {
    client.release();
  }
}

// บันทึกการคืนอุปกรณ์ พร้อมคืนจำนวนสต็อกกลับเข้าคลังและเปลี่ยนสถานะเป็น returned
export async function returnBorrow(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสรายการยืมไม่ถูกต้อง' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{
      id: number;
      user_id: number;
      equipment_id: number;
      quantity: number;
      status: BorrowStatusDb;
      item_codes: string[] | null;
      owner_student_id?: string;
    }>(
      `SELECT b.id, b.user_id, b.equipment_id, b.quantity, b.status, b.item_codes, u.student_id AS owner_student_id
       FROM borrows b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1
       FOR UPDATE OF b`,
      [id]
    );
    const borrow = existing.rows[0];

    if (!borrow) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'ไม่พบรายการยืม' });
      return;
    }

    const isOwner =
      Number(borrow.user_id) === Number(req.user.id) ||
      (Boolean(borrow.owner_student_id) &&
        String(borrow.owner_student_id).trim() === String(req.user.studentId).trim());
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      await client.query('ROLLBACK');
      res.status(403).json({
        message: 'ไม่มีสิทธิ์อัปเดตรายการนี้ (เฉพาะเจ้าของคำขอหรือแอดมินเท่านั้น)',
      });
      return;
    }

    if (borrow.status === 'returned') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'รายการนี้ได้รับการบันทึกคืนเรียบร้อยแล้ว' });
      return;
    }

    // 1. อัปเดตสถานะในตาราง borrows เป็น returned และบันทึกวันที่คืนจริง
    await client.query(
      `UPDATE borrows
       SET status = 'returned',
           return_date = COALESCE(return_date, CURRENT_DATE)
       WHERE id = $1`,
      [borrow.id]
    );

    // 2. ปลดล็อกรหัสประจำชิ้นใน equipment_items คืนเป็น available
    const itemCodes = Array.isArray(borrow.item_codes)
      ? borrow.item_codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : [];

    if (itemCodes.length > 0) {
      await client.query(
        `UPDATE equipment_items
         SET status = 'available', borrow_id = NULL
         WHERE (borrow_id = $1 OR item_code = ANY($2::text[]))
           AND status != 'damaged'`,
        [borrow.id, itemCodes]
      );
    } else {
      await client.query(
        `UPDATE equipment_items
         SET status = 'available', borrow_id = NULL
         WHERE borrow_id = $1 AND status != 'damaged'`,
        [borrow.id]
      );
    }

    // 3. คืนยอด available_qty ให้ equipment (จำกัดเพดานไม่ให้เกิน total_qty ตาม check constraint)
    await client.query(
      `UPDATE equipment
       SET available_qty = LEAST(total_qty, GREATEST(0, available_qty + $1))
       WHERE id = $2`,
      [borrow.quantity, borrow.equipment_id]
    );

    // 4. ซิงค์ available_qty จาก equipment_items หากมีชิ้นระบุไว้
    const itemsCount = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM equipment_items WHERE equipment_id = $1`,
      [borrow.equipment_id]
    );
    if ((itemsCount.rows[0]?.count ?? 0) > 0) {
      await client.query(
        `UPDATE equipment
         SET available_qty = LEAST(
           total_qty,
           GREATEST(
             0,
             (
               SELECT COUNT(*)::int
               FROM equipment_items
               WHERE equipment_id = $1 AND status = 'available'
             )
           )
         )
         WHERE id = $1`,
        [borrow.equipment_id]
      );
    }

    await refreshEquipmentStatus(client, borrow.equipment_id);
    await client.query('COMMIT');

    const updated = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [borrow.id]);
    const row = updated.rows[0];
    if (!row) {
      res.status(500).json({ message: 'อัปเดตสถานะไม่สำเร็จ' });
      return;
    }

    res.json({
      message: `บันทึกการส่งคืนอุปกรณ์ "${row.equipment}" เรียบร้อยแล้ว`,
      borrow: toBorrow(row),
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in returnBorrow:', error);
    res.status(500).json({
      message: 'ไม่สามารถบันทึกการคืนได้',
      error: error?.message || String(error),
      code: error?.code,
      detail: error?.detail,
    });
  } finally {
    client.release();
  }
}

// ตรวจสอบ QR Code หรือรหัสที่ Admin สแกน/กรอก เพื่อสลับสถานะรับของหรือคืนของอัตโนมัติ
export async function verifyScan(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const rawToken = readString(req.body?.token);
  if (!rawToken) {
    res.status(400).json({ message: 'กรุณาระบุรหัสสแกน' });
    return;
  }

  try {
    const currentStep = Math.floor(Math.floor(Date.now() / 1000) / 30);
    let targetBorrowId: number | null = null;
    let targetStudentId: string | null = null;
    let tokenStr = rawToken.trim();

    // 1. ตรวจสอบกรณีส่งข้อมูลมาเป็น JSON (จาก Dynamic QR Code ของนักศึกษา)
    if (tokenStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(tokenStr);
        if (parsed.requestId && Number.isInteger(Number(parsed.requestId))) {
          targetBorrowId = Number(parsed.requestId);
        }
        if (parsed.studentId) {
          targetStudentId = String(parsed.studentId).trim();
        }
        if (parsed.token && typeof parsed.token === 'string') {
          tokenStr = parsed.token.trim();
        }
      } catch {
        // fallback to string processing
      }
    }

    if (!targetBorrowId && tokenStr.startsWith('UTCC-PASS:')) {
      const parts = tokenStr.split(':');
      const borrowId = Number(parts[1]);
      const step = Number(parts[2]);
      const sig = parts[3] || '';

      if (!Number.isInteger(borrowId) || !Number.isInteger(step) || !sig) {
        res.status(400).json({ message: 'รูปแบบ QR Code ไม่ถูกต้อง' });
        return;
      }

      if (Math.abs(currentStep - step) > 1) {
        res.status(401).json({ message: 'QR Code หมดอายุแล้ว กรุณารีเฟรชจากหน้านักศึกษา' });
        return;
      }

      const borrowCheck = await pool.query<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM borrows WHERE id = $1',
        [borrowId]
      );
      const found = borrowCheck.rows[0];
      if (!found) {
        res.status(404).json({ message: 'ไม่พบคำขอยืมสำหรับ QR Code นี้' });
        return;
      }

      const expectedSig = signQrPayload(String(found.user_id), found.id, step);
      if (!verifySignature(expectedSig, sig)) {
        res.status(401).json({ message: 'ลายเซ็น QR Code ไม่ถูกต้อง' });
        return;
      }

      targetBorrowId = found.id;
    } else if (!targetBorrowId && tokenStr.startsWith('UTCC-ID:')) {
      const parts = tokenStr.split(':');
      const studentId = parts[1] || '';
      const step = Number(parts[2]);
      const sig = parts[3] || '';

      if (!studentId || !Number.isInteger(step) || !sig) {
        res.status(400).json({ message: 'รูปแบบ QR Code ไม่ถูกต้อง' });
        return;
      }

      if (Math.abs(currentStep - step) > 1) {
        res.status(401).json({ message: 'QR Code หมดอายุแล้ว กรุณารีเฟรชจากหน้านักศึกษา' });
        return;
      }

      const expectedSig = signQrPayload(studentId, 0, step);
      if (!verifySignature(expectedSig, sig)) {
        res.status(401).json({ message: 'ลายเซ็น QR Code ไม่ถูกต้อง' });
        return;
      }

      targetStudentId = studentId;
    } else if (!targetBorrowId) {
      // Manual fallback (Admin กรอกรหัสนักศึกษา, REQ-0001, หรือ Borrow ID)
      const cleaned = tokenStr
        .replace(/^UTCC-QR-/i, '')
        .replace(/^REQ-0*/i, '')
        .split(':')[0]
        ?.trim() || '';

      if (!cleaned) {
        res.status(400).json({ message: 'กรุณาระบุรหัสสแกนให้ถูกต้อง' });
        return;
      }

      const isReqFormat = /^REQ-0*/i.test(tokenStr);
      const numericId = Number(cleaned);

      // ถ้าเป็นรหัสแบบ REQ-0011 หรือตัวเลข ID ของรายการโดยตรง ให้ลองตรวจหา Borrow ID ก่อน
      if ((isReqFormat || (Number.isInteger(numericId) && numericId > 0 && numericId < 100000)) && Number.isInteger(numericId) && numericId > 0) {
        const byId = await pool.query<{ id: number }>(
          `SELECT id FROM borrows WHERE id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed') LIMIT 1`,
          [numericId]
        );
        if (byId.rows[0]) {
          targetBorrowId = byId.rows[0].id;
        }
      }

      if (!targetBorrowId) {
        // ค้นหาตามรหัสนักศึกษา (ครอบคลุมทั้งรอรับของและกำลังยืม 'borrowing'/'borrowed')
        const byStudent = await pool.query<{ id: number }>(
          `SELECT b.id
           FROM borrows b
           JOIN users u ON u.id = b.user_id
           WHERE u.student_id = $1 AND b.status IN ('pending', 'approved', 'borrowing', 'borrowed')
           ORDER BY b.id DESC
           LIMIT 1`,
          [cleaned]
        );

        if (byStudent.rows[0]) {
          targetBorrowId = byStudent.rows[0].id;
        } else if (Number.isInteger(numericId) && numericId > 0) {
          const byId = await pool.query<{ id: number }>(
            `SELECT id FROM borrows WHERE id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed') LIMIT 1`,
            [numericId]
          );
          if (byId.rows[0]) {
            targetBorrowId = byId.rows[0].id;
          }
        }
      }
    }

    if (targetStudentId && !targetBorrowId) {
      const byStudent = await pool.query<{ id: number }>(
        `SELECT b.id
         FROM borrows b
         JOIN users u ON u.id = b.user_id
         WHERE u.student_id = $1 AND b.status IN ('pending', 'approved', 'borrowing', 'borrowed')
         ORDER BY b.id DESC
         LIMIT 1`,
        [targetStudentId]
      );
      targetBorrowId = byStudent.rows[0]?.id ?? null;
    }

    if (!targetBorrowId) {
      res.status(404).json({ message: 'ไม่พบคำขอยืมที่รอรับของหรือกำลังยืมสำหรับรหัสนี้' });
      return;
    }

    // ดำเนินการเปลี่ยนสถานะแบบ Atomic Transaction: pending/approved -> borrowing (รับของ), borrowing/borrowed -> returned (คืนของ)
    const client = await pool.connect();
    let action: 'pickup' | 'return' = 'return';

    try {
      await client.query('BEGIN');

      const locked = await client.query<{
        id: number;
        equipment_id: number;
        quantity: number;
        status: BorrowStatusDb;
        item_codes: string[] | null;
      }>(
        `SELECT id, equipment_id, quantity, status, item_codes
         FROM borrows
         WHERE id = $1
         FOR UPDATE`,
        [targetBorrowId]
      );
      const borrow = locked.rows[0];

      if (!borrow || borrow.status === 'returned') {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'ไม่พบรายการยืมที่รอรับของหรือยังไม่ได้คืนสำหรับรหัสนี้' });
        return;
      }

      if (borrow.status === 'pending' || borrow.status === 'approved') {
        action = 'pickup';
        await client.query(`UPDATE borrows SET status = 'borrowing' WHERE id = $1`, [borrow.id]);
        await client.query(
          `UPDATE equipment_items
           SET status = 'borrowed'
           WHERE borrow_id = $1 AND status != 'damaged'`,
          [borrow.id]
        );
      } else {
        action = 'return';
        await client.query(
          `UPDATE borrows
           SET status = 'returned',
               return_date = COALESCE(return_date, CURRENT_DATE)
           WHERE id = $1`,
          [borrow.id]
        );

        const itemCodes = Array.isArray(borrow.item_codes)
          ? borrow.item_codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          : [];

        if (itemCodes.length > 0) {
          await client.query(
            `UPDATE equipment_items
             SET status = 'available', borrow_id = NULL
             WHERE (borrow_id = $1 OR item_code = ANY($2::text[]))
               AND status != 'damaged'`,
            [borrow.id, itemCodes]
          );
        } else {
          await client.query(
            `UPDATE equipment_items
             SET status = 'available', borrow_id = NULL
             WHERE borrow_id = $1 AND status != 'damaged'`,
            [borrow.id]
          );
        }

        await client.query(
          `UPDATE equipment
           SET available_qty = LEAST(total_qty, GREATEST(0, available_qty + $1))
           WHERE id = $2`,
          [borrow.quantity, borrow.equipment_id]
        );

        const itemsCount = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM equipment_items WHERE equipment_id = $1`,
          [borrow.equipment_id]
        );
        if ((itemsCount.rows[0]?.count ?? 0) > 0) {
          await client.query(
            `UPDATE equipment
             SET available_qty = LEAST(
               total_qty,
               GREATEST(
                 0,
                 (
                   SELECT COUNT(*)::int
                   FROM equipment_items
                   WHERE equipment_id = $1 AND status = 'available'
                 )
               )
             )
             WHERE id = $1`,
            [borrow.equipment_id]
          );
        }

        await refreshEquipmentStatus(client, borrow.equipment_id);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const updated = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [targetBorrowId]);
    const row = updated.rows[0];
    if (!row) {
      res.status(500).json({ message: 'อัปเดตสถานะไม่สำเร็จ' });
      return;
    }

    res.json({
      action,
      message:
        action === 'pickup'
          ? `ยืนยันการรับอุปกรณ์ "${row.equipment}" สำเร็จ (กำลังยืม)`
          : `ยืนยันการคืนอุปกรณ์ "${row.equipment}" สำเร็จ`,
      borrow: toBorrow(row),
    });
  } catch (error: any) {
    console.error('Error in verifyScan:', error);
    res.status(500).json({
      message: 'ไม่สามารถดำเนินการสแกนได้',
      error: error?.message || String(error),
      detail: error?.detail,
    });
  }
}

// ลบรายการยืมออกจากระบบ (Admin เท่านั้น) พร้อมคืนสต็อกหากยังไม่ได้คืน
export async function deleteBorrow(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสรายการยืมไม่ถูกต้อง' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{
      id: number;
      equipment_id: number;
      quantity: number;
      status: BorrowStatusDb;
    }>(
      `SELECT id, equipment_id, quantity, status
       FROM borrows
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    const borrow = existing.rows[0];

    if (!borrow) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'ไม่พบรายการยืม' });
      return;
    }

    if (borrow.status === 'pending' || borrow.status === 'borrowing' || borrow.status === 'approved') {
      await client.query(
        'UPDATE equipment SET available_qty = LEAST(total_qty, GREATEST(0, available_qty + $1)) WHERE id = $2',
        [borrow.quantity, borrow.equipment_id]
      );
      await client.query(
        `UPDATE equipment_items SET status = 'available', borrow_id = NULL WHERE borrow_id = $1`,
        [borrow.id]
      );
      await refreshEquipmentStatus(client, borrow.equipment_id);
    }

    await client.query('DELETE FROM borrows WHERE id = $1', [borrow.id]);
    await client.query('COMMIT');
    res.json({ message: 'ลบรายการยืมแล้ว' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in deleteBorrow:', error);
    res.status(500).json({
      message: 'ไม่สามารถลบรายการยืมได้',
      error: error?.message || String(error),
      detail: error?.detail,
    });
  } finally {
    client.release();
  }
}
