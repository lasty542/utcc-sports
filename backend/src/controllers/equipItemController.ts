/**
 * โมดูลจัดการรหัสประจำชิ้นและสถานะอุปกรณ์รายชิ้น (Serial Tracking)
 */
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { readString } from '../utils';

interface EquipmentItemRow {
  id: number;
  equipment_id: number;
  item_code: string;
  status: 'available' | 'reserved' | 'borrowed' | 'damaged';
  borrow_id: number | null;
  created_at: string;
}

// ดึงรหัสประจำชิ้นทั้งหมด (Serial Tracking) ของอุปกรณ์ชิ้นนั้นๆ
export async function listEquipmentItems(req: Request, res: Response): Promise<void> {
  const equipId = Number(req.params.id);
  if (!Number.isInteger(equipId)) {
    res.status(400).json({ message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    return;
  }

  try {
    const result = await pool.query<EquipmentItemRow>(
      `SELECT id, equipment_id, item_code, status, borrow_id, created_at::text
       FROM equipment_items
       WHERE equipment_id = $1
       ORDER BY id ASC`,
      [equipId]
    );

    res.json({
      items: result.rows.map((row) => ({
        id: row.id,
        equipmentId: row.equipment_id,
        itemCode: row.item_code,
        status: row.status,
        borrowId: row.borrow_id,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถโหลดรหัสอุปกรณ์รายชิ้นได้' });
  }
}

// อัปเดตสถานะของอุปกรณ์รายชิ้น (เช่น "ชำรุด (damaged)" หรือ "พร้อมใช้งาน (available)")
export async function updateItemStatus(req: Request, res: Response): Promise<void> {
  const itemId = Number(req.params.itemId);
  const nextStatus = readString(req.body?.status);

  if (!Number.isInteger(itemId) || (nextStatus !== 'damaged' && nextStatus !== 'available')) {
    res.status(400).json({ message: 'ระบุสถานะเป็น damaged หรือ available เท่านั้น' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query<{ id: number; equipment_id: number; status: string }>(
      'SELECT id, equipment_id, status FROM equipment_items WHERE id = $1 FOR UPDATE',
      [itemId]
    );
    const targetItem = itemRes.rows[0];

    if (!targetItem) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'ไม่พบอุปกรณ์รายชิ้นนี้' });
      return;
    }

    if (targetItem.status === 'borrowed' || targetItem.status === 'reserved') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'ไม่สามารถเปลี่ยนสถานะได้เนื่องจากอุปกรณ์กำลังถูกยืมหรือจองอยู่' });
      return;
    }

    await client.query(
      `UPDATE equipment_items
       SET status = $1,
           borrow_id = CASE WHEN $1 = 'damaged' THEN NULL ELSE borrow_id END
       WHERE id = $2`,
      [nextStatus, itemId]
    );

    // ปรับปรุงจำนวน available_qty ในตาราง equipment ตามตรรกะ LEAST(total_qty, ...)
    await client.query(
      `UPDATE equipment
       SET available_qty = LEAST(
         total_qty,
         (
           SELECT COUNT(*)::int
           FROM equipment_items
           WHERE equipment_id = $1 AND status = 'available'
         )
       )
       WHERE id = $1`,
      [targetItem.equipment_id]
    );

    await client.query('COMMIT');

    const updatedEquip = await pool.query<{
      id: number;
      name: string;
      category: string | null;
      description: string | null;
      total_qty: number;
      available_qty: number;
      image: string | null;
      icon: string | null;
      status: string;
    }>(
      `SELECT id, name, category, description, total_qty, available_qty, image, icon, status
       FROM equipment
       WHERE id = $1`,
      [targetItem.equipment_id]
    );

    const row = updatedEquip.rows[0];
    res.json({
      message:
        nextStatus === 'damaged'
          ? 'บันทึกอุปกรณ์ชำรุดและตัดสต็อกพร้อมใช้งานแล้ว'
          : 'ปรับสถานะอุปกรณ์เป็นพร้อมใช้งานเรียบร้อยแล้ว',
      equipment: row
        ? {
            id: row.id,
            name: row.name,
            category: row.category,
            description: row.description,
            totalQty: row.total_qty,
            availableQty: row.available_qty,
            image: row.image,
            icon: row.icon,
            status: row.status,
          }
        : null,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตสถานะอุปกรณ์ได้' });
  } finally {
    client.release();
  }
}
