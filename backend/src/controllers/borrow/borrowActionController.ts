/**
 * โมดูลสร้างและยกเลิกคำขอยืมอุปกรณ์
 */
import type { Request, Response } from 'express';
import { pool } from '../../config/db';
import { isDateString, readString } from '../../utils';
import {
  BORROW_SELECT,
  type BorrowRow,
  type BorrowStatusDb,
  refreshEquipmentStatus,
  toBorrow,
} from './borrowHelpers';

// สร้างคำขอยืมอุปกรณ์ใหม่ พร้อมตัดสต็อกและจัดสรรรหัสประจำชิ้น (Serial Tracking)
export async function createBorrow(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const equipmentId = Number(req.body?.equipmentId ?? req.body?.equipment_id);
  const quantity = Number(req.body?.quantity ?? req.body?.qty);
  const purpose = readString(req.body?.purpose);
  const rawBorrowDate = readString(req.body?.borrowDate ?? req.body?.borrow_date);
  const rawDueDate = readString(
    req.body?.dueDate ?? req.body?.due_date ?? req.body?.returnDate ?? req.body?.return_date
  );
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

  // 1. ตรวจสอบรายการเกินกำหนดส่งคืน (Overdue)
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

  // 2. ตรวจสอบโควตาการยืม (สูงสุด 3 ชิ้น และไม่เกิน 3 คำขอพร้อมกัน)
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

  if (currentRequests >= 3) {
    res.status(400).json({
      message: 'คุณมีคำขอยืมที่รอดำเนินการครบ 3 คำขอแล้ว (จำกัดสูงสุดไม่เกิน 3 คำขอพร้อมกัน)',
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

    // เลือกรหัสประจำชิ้น (Serial Items) ที่ว่างอยู่
    let serialQuery = await client.query<{ id: number; item_code: string }>(
      `SELECT id, item_code
       FROM equipment_items
       WHERE equipment_id = $1 AND status = 'available'
       ORDER BY id ASC
       LIMIT $2
       FOR UPDATE`,
      [equipmentId, quantity]
    );

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
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in createBorrow:', error);
    res.status(500).json({ message: 'ไม่สามารถบันทึกการยืมได้', error: msg });
  } finally {
    client.release();
  }
}

// ลบรายการยืมและคืนสต็อกอุปกรณ์ (Admin)
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
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in deleteBorrow:', error);
    res.status(500).json({ message: 'ไม่สามารถลบรายการยืมได้', error: msg });
  } finally {
    client.release();
  }
}
