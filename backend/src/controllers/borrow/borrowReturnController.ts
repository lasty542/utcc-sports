/**
 * โมดูลยืนยันการรับอุปกรณ์และบันทึกการส่งคืนอุปกรณ์
 */
import type { Request, Response } from 'express';
import { pool } from '../../config/db';
import {
  BORROW_SELECT,
  type BorrowRow,
  type BorrowStatusDb,
  refreshEquipmentStatus,
  toBorrow,
} from './borrowHelpers';

// ยืนยันการรับอุปกรณ์ (เปลี่ยนสถานะจาก pending/approved เป็น borrowing)
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
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in confirmPickup:', error);
    res.status(500).json({ message: 'ไม่สามารถยืนยันรับอุปกรณ์ได้', error: msg });
  } finally {
    client.release();
  }
}

// บันทึกการส่งคืนอุปกรณ์ พร้อมคืนสต็อกกลับเข้าคลัง
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
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in returnBorrow:', error);
    res.status(500).json({ message: 'ไม่สามารถบันทึกการคืนได้', error: msg });
  } finally {
    client.release();
  }
}
