/**
 * ตัวควบคุม (Controller) จัดการข้อมูลคลังอุปกรณ์กีฬา (ดึงรายการ, ดูรายละเอียด, เพิ่ม, แก้ไข, ลบ)
 */
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { readQuantity, readString } from '../utils';

interface EquipmentRow {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  total_qty: number;
  available_qty: number;
  image: string | null;
  icon: string | null;
  status: string;
}

// แปลงแถวข้อมูลอุปกรณ์จาก PostgreSQL ให้เป็นรูปแบบ JSON ที่ Frontend ใช้งาน
function toEquipment(row: EquipmentRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    desc: row.description,
    total: row.total_qty,
    available: row.available_qty,
    totalQty: row.total_qty,
    availableQty: row.available_qty,
    image: row.image,
    icon: row.icon,
    status: row.status,
  };
}

// คำนวณข้อความสถานะอุปกรณ์จากจำนวนทั้งหมดและจำนวนคงเหลือ
function stockStatus(totalQty: number, availableQty: number, explicit?: string): string {
  if (explicit) {
    return explicit;
  }
  return availableQty === totalQty ? 'พร้อมใช้งาน' : 'ใช้งานอยู่';
}

const EQUIPMENT_COLUMNS = `
  id, name, category, description, total_qty, available_qty, image, icon, status
`;

// ดึงรายการอุปกรณ์กีฬาทั้งหมด พร้อมกรองตามหมวดหมู่และคำค้นหา
export async function listEquipment(req: Request, res: Response): Promise<void> {
  const category = readString(req.query.category);
  const search = readString(req.query.search);

  try {
    const result = await pool.query<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS}
       FROM equipment
       WHERE ($1::text = '' OR category = $1)
         AND ($2::text = '' OR name ILIKE '%' || $2 || '%')
       ORDER BY id DESC`,
      [category, search]
    );

    res.json({ equipment: result.rows.map(toEquipment) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายการอุปกรณ์ได้' });
  }
}

// ดึงข้อมูลรายละเอียดอุปกรณ์กีฬา 1 รายการตามรหัส ID
export async function getEquipment(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    return;
  }

  try {
    const result = await pool.query<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM equipment WHERE id = $1`,
      [id]
    );
    const item = result.rows[0];

    if (!item) {
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    res.json({ equipment: toEquipment(item) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถโหลดอุปกรณ์ได้' });
  }
}

// เพิ่มรายการอุปกรณ์กีฬาใหม่เข้าสู่คลัง (เฉพาะ Admin)
export async function createEquipment(req: Request, res: Response): Promise<void> {
  const name = readString(req.body?.name);
  const category = readString(req.body?.category);
  const description = readString(req.body?.description ?? req.body?.desc);
  const image = readString(req.body?.image);
  const icon = readString(req.body?.icon);
  const totalQty = readQuantity(req.body?.totalQty ?? req.body?.total);
  const availableQty = readQuantity(req.body?.availableQty ?? req.body?.available ?? totalQty);

  if (!name || totalQty === null || availableQty === null || availableQty > totalQty) {
    res.status(400).json({ message: 'กรอกชื่ออุปกรณ์และจำนวนให้ถูกต้อง' });
    return;
  }

  try {
    const result = await pool.query<EquipmentRow>(
      `INSERT INTO equipment
        (name, category, description, total_qty, available_qty, image, icon, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${EQUIPMENT_COLUMNS}`,
      [
        name,
        category || null,
        description || null,
        totalQty,
        availableQty,
        image || null,
        icon || null,
        stockStatus(totalQty, availableQty, readString(req.body?.status) || undefined),
      ]
    );

    const item = result.rows[0];
    if (!item) {
      res.status(500).json({ message: 'เพิ่มอุปกรณ์ไม่สำเร็จ' });
      return;
    }

    res.status(201).json({ equipment: toEquipment(item) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถเพิ่มอุปกรณ์ได้' });
  }
}

// แก้ไขรายละเอียดและจำนวนอุปกรณ์กีฬาตามรหัส ID (เฉพาะ Admin)
export async function updateEquipment(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    return;
  }

  const name = readString(req.body?.name);
  const category = readString(req.body?.category);
  const description = readString(req.body?.description ?? req.body?.desc);
  const image = readString(req.body?.image);
  const icon = readString(req.body?.icon);
  const totalQty = readQuantity(req.body?.totalQty ?? req.body?.total);
  const availableQty = readQuantity(req.body?.availableQty ?? req.body?.available);

  if (!name || totalQty === null || availableQty === null || availableQty > totalQty) {
    res.status(400).json({ message: 'กรอกชื่ออุปกรณ์และจำนวนให้ถูกต้อง' });
    return;
  }

  try {
    const result = await pool.query<EquipmentRow>(
      `UPDATE equipment
       SET name = $1,
           category = $2,
           description = $3,
           total_qty = $4,
           available_qty = $5,
           image = $6,
           icon = $7,
           status = $8
       WHERE id = $9
       RETURNING ${EQUIPMENT_COLUMNS}`,
      [
        name,
        category || null,
        description || null,
        totalQty,
        availableQty,
        image || null,
        icon || null,
        stockStatus(totalQty, availableQty, readString(req.body?.status) || undefined),
        id,
      ]
    );

    const item = result.rows[0];
    if (!item) {
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    res.json({ equipment: toEquipment(item) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถแก้ไขอุปกรณ์ได้' });
  }
}

// ลบรายการอุปกรณ์กีฬาออกจากคลัง (ป้องกันการลบหากมีประวัติการยืมผูกอยู่)
export async function deleteEquipment(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    return;
  }

  try {
    const result = await pool.query('DELETE FROM equipment WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    res.json({ message: 'ลบอุปกรณ์แล้ว' });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23503') {
      res.status(409).json({ message: 'ลบไม่ได้เพราะอุปกรณ์นี้มีประวัติการยืม' });
      return;
    }

    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถลบอุปกรณ์ได้' });
  }
}

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

// อัปเดตสถานะของอุปกรณ์รายชิ้น (เช่น Admin กดเปลี่ยนเป็น "ชำรุด (damaged)" หรือ "พร้อมใช้งาน (available)")
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

    // ปรับปรุงจำนวน available_qty ในตาราง equipment ให้อัปเดตอัตโนมัติ
    await client.query(
      `UPDATE equipment
       SET available_qty = (
         SELECT COUNT(*)::int
         FROM equipment_items
         WHERE equipment_id = $1 AND status = 'available'
       )
       WHERE id = $1`,
      [targetItem.equipment_id]
    );

    await client.query('COMMIT');

    const updatedEquip = await pool.query<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM equipment WHERE id = $1`,
      [targetItem.equipment_id]
    );

    res.json({
      message: nextStatus === 'damaged' ? 'บันทึกอุปกรณ์ชำรุดและตัดสต็อกพร้อมใช้งานแล้ว' : 'ปรับสถานะอุปกรณ์เป็นพร้อมใช้งานเรียบร้อยแล้ว',
      equipment: updatedEquip.rows[0] ? toEquipment(updatedEquip.rows[0]) : null,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตสถานะอุปกรณ์ได้' });
  } finally {
    client.release();
  }
}
