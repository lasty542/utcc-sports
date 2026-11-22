/**
 * โมดูลตรวจสอบ QR Code และรหัสคำขอผ่านสแกนเนอร์ของเจ้าหน้าที่
 */
import type { Request, Response } from 'express';
import { pool } from '../../config/db';
import { readString } from '../../utils';
import {
  BORROW_SELECT,
  type BorrowRow,
  type BorrowStatusDb,
  refreshEquipmentStatus,
  signQrPayload,
  toBorrow,
  verifySignature,
} from './borrowHelpers';

// ตรวจสอบรหัสจาก QR Code หรือรหัสนักศึกษา/คำขอ เพื่อยืนยันรับหรือคืนของอัตโนมัติ
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

    if (tokenStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(tokenStr);
        if (parsed.requestId && Number.isInteger(Number(parsed.requestId))) targetBorrowId = Number(parsed.requestId);
        if (parsed.studentId) targetStudentId = String(parsed.studentId).trim();
        if (parsed.token && typeof parsed.token === 'string') tokenStr = parsed.token.trim();
      } catch { /* fallback */ }
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

      if (
        (isReqFormat || (Number.isInteger(numericId) && numericId > 0 && numericId < 100000)) &&
        Number.isInteger(numericId) &&
        numericId > 0
      ) {
        const byId = await pool.query<{ id: number }>(
          `SELECT id FROM borrows WHERE id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed') LIMIT 1`,
          [numericId]
        );
        if (byId.rows[0]) {
          targetBorrowId = byId.rows[0].id;
        }
      }

      if (!targetBorrowId) {
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

    const message = action === 'pickup'
      ? `ยืนยันการรับอุปกรณ์ "${row.equipment}" สำเร็จ (กำลังยืม)`
      : `ยืนยันการคืนอุปกรณ์ "${row.equipment}" สำเร็จ`;
    res.json({ action, message, borrow: toBorrow(row) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in verifyScan:', error);
    res.status(500).json({ message: 'ไม่สามารถดำเนินการสแกนได้', error: msg });
  }
}
