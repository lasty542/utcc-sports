/**
 * ตัวควบคุม (Controller) จัดการคำขอยืม-คืนอุปกรณ์, การสร้าง Dynamic QR/PIN และการยืนยันรับ-คืนผ่านสแกน
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { isDateString, readString } from '../utils';

type BorrowStatusDb = 'pending' | 'borrowing' | 'returned';

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
  is_overdue: boolean;
}

// แปลงข้อมูลการยืมจากฐานข้อมูลพร้อมคำนวณป้ายสถานะภาษาไทยและสถานะเกินกำหนดคืน
function toBorrow(row: BorrowRow) {
  const overdue = row.status === 'borrowing' && row.is_overdue;
  const statusType = overdue ? 'overdue' : row.status;

  let statusLabel = 'กำลังยืม';
  if (overdue) statusLabel = 'เกินกำหนดส่งคืน';
  else if (row.status === 'pending') statusLabel = 'รออนุมัติรับอุปกรณ์';
  else if (row.status === 'returned') statusLabel = 'คืนเรียบร้อยแล้ว';

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
    b.quantity,
    b.purpose,
    b.borrow_date::text AS borrow_date,
    b.due_date::text AS due_date,
    b.status,
    (b.status = 'borrowing' AND b.due_date < CURRENT_DATE) AS is_overdue
  FROM borrows b
  JOIN users u ON u.id = b.user_id
  JOIN equipment e ON e.id = b.equipment_id
`;

// อัปเดตสถานะคลังอุปกรณ์ ("พร้อมใช้งาน" / "ใช้งานอยู่") ตามจำนวนคงเหลือจริง
async function refreshEquipmentStatus(client: { query: typeof pool.query }, equipmentId: number): Promise<void> {
  await client.query(
    `UPDATE equipment
     SET status = CASE
       WHEN available_qty = total_qty THEN 'พร้อมใช้งาน'
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายการยืมได้' });
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
         WHERE b.id = $1 AND b.user_id = $2 AND b.status IN ('pending', 'borrowing')`,
        [requestedBorrowId, req.user.id]
      );
      targetBorrow = specific.rows[0];
    }

    if (!targetBorrow) {
      const latestActive = await pool.query<BorrowRow>(
        `${BORROW_SELECT}
         WHERE b.user_id = $1 AND b.status IN ('pending', 'borrowing')
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถสร้างรหัส QR ได้' });
  }
}

// สร้างคำขอยืมอุปกรณ์ใหม่ พร้อมตัดสต็อกและบันทึกสถานะ pending ภายใน Transaction
export async function createBorrow(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const equipmentId = Number(req.body?.equipmentId);
  const quantity = Number(req.body?.quantity ?? req.body?.qty);
  const purpose = readString(req.body?.purpose);
  const borrowDate = readString(req.body?.borrowDate);
  const dueDate = readString(req.body?.dueDate ?? req.body?.returnDate);

  if (!Number.isInteger(equipmentId) || !Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ message: 'ระบุอุปกรณ์และจำนวนที่ต้องการยืม' });
    return;
  }

  if (!isDateString(borrowDate) || !isDateString(dueDate) || dueDate < borrowDate) {
    res.status(400).json({ message: 'ระบุวันที่ยืมและกำหนดคืนในรูปแบบ YYYY-MM-DD' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const equipment = await client.query<{ id: number; available_qty: number }>(
      'SELECT id, available_qty FROM equipment WHERE id = $1 FOR UPDATE',
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

    await client.query(
      'UPDATE equipment SET available_qty = available_qty - $1 WHERE id = $2',
      [quantity, equipmentId]
    );
    await refreshEquipmentStatus(client, equipmentId);

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO borrows (user_id, equipment_id, quantity, purpose, borrow_date, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [req.user.id, equipmentId, quantity, purpose || null, borrowDate, dueDate]
    );
    const borrowId = inserted.rows[0]?.id;

    await client.query('COMMIT');

    const created = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [borrowId]);
    const borrow = created.rows[0];
    if (!borrow) {
      res.status(500).json({ message: 'บันทึกการยืมไม่สำเร็จ' });
      return;
    }

    res.status(201).json({ borrow: toBorrow(borrow) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถบันทึกการยืมได้' });
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
    }>(
      `SELECT id, user_id, status
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

    if (req.user.role !== 'admin' && borrow.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      res.status(403).json({ message: 'ไม่มีสิทธิ์ยืนยันรายการนี้' });
      return;
    }

    if (borrow.status !== 'pending') {
      await client.query('ROLLBACK');
      res.status(409).json({
        message: borrow.status === 'returned' ? 'รายการนี้คืนแล้ว' : 'รายการนี้ยืนยันรับอุปกรณ์แล้ว',
      });
      return;
    }

    await client.query(`UPDATE borrows SET status = 'borrowing' WHERE id = $1`, [borrow.id]);
    await client.query('COMMIT');

    const updated = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [borrow.id]);
    const row = updated.rows[0];
    if (!row) {
      res.status(500).json({ message: 'อัปเดตสถานะไม่สำเร็จ' });
      return;
    }

    res.json({
      message: `ยืนยันรับอุปกรณ์ "${row.equipment}" เรียบร้อยแล้ว`,
      borrow: toBorrow(row),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถยืนยันรับอุปกรณ์ได้' });
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
    }>(
      `SELECT id, user_id, equipment_id, quantity, status
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

    if (req.user.role !== 'admin' && borrow.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      res.status(403).json({ message: 'ไม่มีสิทธิ์อัปเดตรายการนี้' });
      return;
    }

    if (borrow.status === 'returned') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'รายการนี้คืนแล้ว' });
      return;
    }

    await client.query(
      'UPDATE equipment SET available_qty = available_qty + $1 WHERE id = $2',
      [borrow.quantity, borrow.equipment_id]
    );
    await refreshEquipmentStatus(client, borrow.equipment_id);
    await client.query(`UPDATE borrows SET status = 'returned' WHERE id = $1`, [borrow.id]);
    await client.query('COMMIT');

    const updated = await pool.query<BorrowRow>(`${BORROW_SELECT} WHERE b.id = $1`, [borrow.id]);
    const row = updated.rows[0];
    if (!row) {
      res.status(500).json({ message: 'อัปเดตสถานะไม่สำเร็จ' });
      return;
    }

    res.json({ borrow: toBorrow(row) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถบันทึกการคืนได้' });
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

    if (rawToken.startsWith('UTCC-PASS:')) {
      const parts = rawToken.split(':');
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
    } else if (rawToken.startsWith('UTCC-ID:')) {
      const parts = rawToken.split(':');
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
    } else {
      // Manual fallback (Admin กรอกรหัสนักศึกษา, REQ-0001, หรือ Borrow ID)
      const cleaned = rawToken
        .replace(/^UTCC-QR-/i, '')
        .replace(/^REQ-0*/i, '')
        .split(':')[0]
        ?.trim() || '';

      if (!cleaned) {
        res.status(400).json({ message: 'กรุณาระบุรหัสสแกนให้ถูกต้อง' });
        return;
      }

      const byStudent = await pool.query<{ id: number }>(
        `SELECT b.id
         FROM borrows b
         JOIN users u ON u.id = b.user_id
         WHERE u.student_id = $1 AND b.status IN ('pending', 'borrowing')
         ORDER BY b.id DESC
         LIMIT 1`,
        [cleaned]
      );

      if (byStudent.rows[0]) {
        targetBorrowId = byStudent.rows[0].id;
      } else {
        const numericId = Number(cleaned);
        if (Number.isInteger(numericId) && numericId > 0) {
          targetBorrowId = numericId;
        }
      }
    }

    if (targetStudentId && !targetBorrowId) {
      const byStudent = await pool.query<{ id: number }>(
        `SELECT b.id
         FROM borrows b
         JOIN users u ON u.id = b.user_id
         WHERE u.student_id = $1 AND b.status IN ('pending', 'borrowing')
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

    // ดำเนินการเปลี่ยนสถานะแบบ Atomic Transaction: pending -> borrowing (รับของ), borrowing -> returned (คืนของ)
    const client = await pool.connect();
    let action: 'pickup' | 'return' = 'return';

    try {
      await client.query('BEGIN');

      const locked = await client.query<{
        id: number;
        equipment_id: number;
        quantity: number;
        status: BorrowStatusDb;
      }>(
        `SELECT id, equipment_id, quantity, status
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

      if (borrow.status === 'pending') {
        action = 'pickup';
        await client.query(`UPDATE borrows SET status = 'borrowing' WHERE id = $1`, [borrow.id]);
      } else {
        action = 'return';
        await client.query(
          'UPDATE equipment SET available_qty = available_qty + $1 WHERE id = $2',
          [borrow.quantity, borrow.equipment_id]
        );
        await refreshEquipmentStatus(client, borrow.equipment_id);
        await client.query(`UPDATE borrows SET status = 'returned' WHERE id = $1`, [borrow.id]);
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถดำเนินการสแกนได้' });
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

    if (borrow.status === 'pending' || borrow.status === 'borrowing') {
      await client.query(
        'UPDATE equipment SET available_qty = available_qty + $1 WHERE id = $2',
        [borrow.quantity, borrow.equipment_id]
      );
      await refreshEquipmentStatus(client, borrow.equipment_id);
    }

    await client.query('DELETE FROM borrows WHERE id = $1', [borrow.id]);
    await client.query('COMMIT');
    res.json({ message: 'ลบรายการยืมแล้ว' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถลบรายการยืมได้' });
  } finally {
    client.release();
  }
}
