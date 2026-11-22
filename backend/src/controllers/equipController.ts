/**
 * ตัวควบคุม (Controller) จัดการข้อมูลคลังอุปกรณ์กีฬา
 */
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { readQuantity, readString } from '../utils';
import { consolidateEquipmentCatalog } from '../config/seedEquip';

export { listEquipmentItems, updateItemStatus } from './equipItemController';

export interface EquipmentRow {
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

export function toEquipment(row: EquipmentRow) {
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

function stockStatus(totalQty: number, availableQty: number, explicit?: string): string {
  if (explicit) return explicit;
  return availableQty === totalQty ? 'พร้อมใช้งาน' : 'ใช้งานอยู่';
}

const EQUIPMENT_COLUMNS = `
  id, name, category, description, total_qty, available_qty, image, icon, status
`;

// ดึงรายการอุปกรณ์กีฬาทั้งหมด
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

// ดึงรายละเอียดอุปกรณ์ทีละรายการ
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
    const row = result.rows[0];

    if (!row) {
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    res.json({ equipment: toEquipment(row) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลอุปกรณ์ได้' });
  }
}

// เพิ่มอุปกรณ์กีฬาใหม่เข้าสู่ระบบ
export async function createEquipment(req: Request, res: Response): Promise<void> {
  const name = readString(req.body?.name);
  const category = readString(req.body?.category);
  const description = readString(req.body?.description ?? req.body?.desc);
  const totalQty = readQuantity(req.body?.totalQty ?? req.body?.total);
  const availableQty = readQuantity(req.body?.availableQty ?? req.body?.available ?? totalQty);
  const image = readString(req.body?.image);
  const icon = readString(req.body?.icon);

  if (!name || totalQty === null || availableQty === null) {
    res.status(400).json({ message: 'กรอกชื่ออุปกรณ์และจำนวนที่ถูกต้อง' });
    return;
  }

  if (availableQty > totalQty) {
    res.status(400).json({ message: 'จำนวนพร้อมใช้งานต้องไม่เกินจำนวนทั้งหมด' });
    return;
  }

  const status = stockStatus(totalQty, availableQty, readString(req.body?.status));

  try {
    const result = await pool.query<EquipmentRow>(
      `INSERT INTO equipment (name, category, description, total_qty, available_qty, image, icon, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${EQUIPMENT_COLUMNS}`,
      [name, category || null, description || null, totalQty, availableQty, image || null, icon || null, status]
    );

    const newEquip = result.rows[0];

    // สร้างรหัสประจำชิ้น (Serial Items) เริ่มต้นอัตโนมัติ
    for (let i = 1; i <= totalQty; i++) {
      const itemCode = `EQ-${String(newEquip.id).padStart(3, '0')}-${String(i).padStart(2, '0')}`;
      await pool.query(
        `INSERT INTO equipment_items (equipment_id, item_code, status)
         VALUES ($1, $2, 'available')
         ON CONFLICT (item_code) DO NOTHING`,
        [newEquip.id, itemCode]
      );
    }

    res.status(201).json({ equipment: toEquipment(newEquip) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถเพิ่มอุปกรณ์ได้' });
  }
}

// แก้ไขข้อมูลอุปกรณ์กีฬา
export async function updateEquipment(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    return;
  }

  const name = readString(req.body?.name);
  const category = readString(req.body?.category);
  const description = readString(req.body?.description ?? req.body?.desc);
  const totalQty = readQuantity(req.body?.totalQty ?? req.body?.total);
  const availableQty = readQuantity(req.body?.availableQty ?? req.body?.available);
  const image = readString(req.body?.image);
  const icon = readString(req.body?.icon);

  try {
    const currentRes = await pool.query<EquipmentRow>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM equipment WHERE id = $1`,
      [id]
    );
    const current = currentRes.rows[0];

    if (!current) {
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    const nextTotal = totalQty ?? current.total_qty;
    const nextAvailable = availableQty ?? current.available_qty;

    if (nextAvailable > nextTotal) {
      res.status(400).json({ message: 'จำนวนพร้อมใช้งานต้องไม่เกินจำนวนทั้งหมด' });
      return;
    }

    const nextStatus = stockStatus(nextTotal, nextAvailable, readString(req.body?.status));

    const result = await pool.query<EquipmentRow>(
      `UPDATE equipment
       SET name = $1, category = $2, description = $3, total_qty = $4, available_qty = $5, image = $6, icon = $7, status = $8
       WHERE id = $9
       RETURNING ${EQUIPMENT_COLUMNS}`,
      [
        name || current.name,
        category || current.category,
        description || current.description,
        nextTotal,
        nextAvailable,
        image || current.image,
        icon || current.icon,
        nextStatus,
        id,
      ]
    );

    res.json({ equipment: toEquipment(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถแก้ไขอุปกรณ์ได้' });
  }
}

// ลบอุปกรณ์กีฬาออกจากระบบ
export async function deleteEquipment(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    return;
  }

  try {
    const activeBorrows = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM borrows
       WHERE equipment_id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed')`,
      [id]
    );

    if ((activeBorrows.rows[0]?.count ?? 0) > 0) {
      res.status(400).json({ message: 'ไม่สามารถลบได้เนื่องจากมีรายการยืมที่ยังไม่ได้คืน' });
      return;
    }

    await pool.query('DELETE FROM equipment_items WHERE equipment_id = $1', [id]);
    const result = await pool.query('DELETE FROM equipment WHERE id = $1', [id]);

    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
      return;
    }

    res.json({ message: 'ลบอุปกรณ์เรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถลบอุปกรณ์ได้' });
  }
}

// จัดระเบียบและยุบรวมคลังอุปกรณ์ให้ตรงกับ 5 รายการหลักมาตรฐาน
export async function consolidateEquipment(_req: Request, res: Response): Promise<void> {
  try {
    await consolidateEquipmentCatalog(pool);
    res.json({ message: 'จัดระเบียบและซิงก์คลังอุปกรณ์ 5 รายการหลักเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถจัดระเบียบรายการอุปกรณ์ได้' });
  }
}
