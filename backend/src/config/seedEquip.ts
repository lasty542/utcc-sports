/**
 * โมดูล Seed ข้อมูลเริ่มต้นและจัดระเบียบรายการอุปกรณ์กีฬา (Consolidate Equipment)
 */
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

export const STANDARD_EQUIPMENT = [
  {
    name: 'ลูกฟุตบอล Molten No.5',
    category: 'ฟุตบอล',
    description: 'ลูกบอลหนังมาตรฐาน สำหรับใช้สนามหญ้าและสนามปูน',
    total_qty: 10,
    available_qty: 10,
    image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop',
    status: 'พร้อมใช้งาน',
  },
  {
    name: 'ลูกบาสเกตบอล Spalding',
    category: 'บาสเกตบอล',
    description: 'ลูกบาสเกตบอลยางกันกระแทกอย่างดี สำหรับสนามกลางแจ้งและในร่ม',
    total_qty: 8,
    available_qty: 8,
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop',
    status: 'พร้อมใช้งาน',
  },
  {
    name: 'ลูกวอลเลย์บอล Mikasa',
    category: 'วอลเลย์บอล',
    description: 'ลูกวอลเลย์บอลผิวสัมผัสนุ่ม ลดแรงกระแทกแขน',
    total_qty: 6,
    available_qty: 6,
    image: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop',
    status: 'พร้อมใช้งาน',
  },
  {
    name: 'ชุดไม้แบดมินตัน Yonex (2 ไม้ + ลูก)',
    category: 'แบดมินตัน',
    description: 'ไม้แบดมินตันพร้อมลูกขนไก่ 1 ชุดประกอบด้วยไม้ 2 อัน',
    total_qty: 12,
    available_qty: 12,
    image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop',
    status: 'พร้อมใช้งาน',
  },
  {
    name: 'ชุดไม้ปิงปอง Butterfly (2 ไม้ + 3 ลูก)',
    category: 'เทเบิลเทนนิส',
    description: 'ไม้ปิงปองมาตรฐานพร้อมลูกปิงปอง 3 ดาว',
    total_qty: 10,
    available_qty: 10,
    image: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?q=80&w=600&auto=format&fit=crop',
    status: 'พร้อมใช้งาน',
  },
];

// สร้างรหัสอุปกรณ์รายชิ้น (EQ-xxx-yy) และคำนวณ available_qty ให้แม่นยำ
export async function syncEquipmentItems(pool: Pool): Promise<void> {
  try {
    const equips = await pool.query<{ id: number; total_qty: number }>(
      'SELECT id, total_qty FROM equipment'
    );

    for (const eq of equips.rows) {
      const existing = await pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM equipment_items WHERE equipment_id = $1',
        [eq.id]
      );
      const currentCount = existing.rows[0]?.count ?? 0;
      const targetCount = Math.max(eq.total_qty || 0, 1);

      if (currentCount < targetCount) {
        for (let i = 1; i <= targetCount; i++) {
          const itemCode = `EQ-${String(eq.id).padStart(3, '0')}-${String(i).padStart(2, '0')}`;
          await pool.query(
            `INSERT INTO equipment_items (equipment_id, item_code, status)
             VALUES ($1, $2, 'available')
             ON CONFLICT (item_code) DO NOTHING`,
            [eq.id, itemCode]
          );
        }
      }
    }

    // อัปเดต available_qty โดยไม่เกิน total_qty ตามตรรกะ LEAST(total_qty, ...)
    await pool.query(`
      UPDATE equipment e
      SET available_qty = LEAST(
        e.total_qty,
        (
          SELECT COUNT(*)::int
          FROM equipment_items ei
          WHERE ei.equipment_id = e.id AND ei.status = 'available'
        )
      )
    `);
    console.log('[Auto-Migration] Equipment items & available_qty synchronized.');
  } catch (error) {
    console.error('[Auto-Migration] Failed to sync equipment items:', error);
  }
}

// ยุบรวมและจัดระเบียบคลังอุปกรณ์ให้ตรงกับ 5 รายการหลักเหมือน localhost
export async function consolidateEquipmentCatalog(pool: Pool): Promise<void> {
  try {
    console.log('[Auto-Migration] Consolidating equipment catalog to match standard list...');

    // 1. ตรวจสอบและสร้าง 5 รายการอุปกรณ์หลักให้ครบถ้วน
    const canonicalMap = new Map<string, number>();

    for (const item of STANDARD_EQUIPMENT) {
      const res = await pool.query<{ id: number }>(
        'SELECT id FROM equipment WHERE name = $1 ORDER BY id ASC LIMIT 1',
        [item.name]
      );
      let id: number;
      if (res.rows.length === 0) {
        const ins = await pool.query<{ id: number }>(
          `INSERT INTO equipment (name, category, description, total_qty, available_qty, image, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [item.name, item.category, item.description, item.total_qty, item.available_qty, item.image, item.status]
        );
        id = ins.rows[0].id;
      } else {
        id = res.rows[0].id;
        await pool.query(
          `UPDATE equipment
           SET category = $1, description = $2, image = $3, status = $4
           WHERE id = $5`,
          [item.category, item.description, item.image, item.status, id]
        );
      }
      canonicalMap.set(item.name, id);
    }

    const footballId = canonicalMap.get('ลูกฟุตบอล Molten No.5')!;
    const basketballId = canonicalMap.get('ลูกบาสเกตบอล Spalding')!;
    const volleyballId = canonicalMap.get('ลูกวอลเลย์บอล Mikasa')!;
    const badmintonId = canonicalMap.get('ชุดไม้แบดมินตัน Yonex (2 ไม้ + ลูก)')!;
    const tabletennisId = canonicalMap.get('ชุดไม้ปิงปอง Butterfly (2 ไม้ + 3 ลูก)')!;
    const standardIds = [footballId, basketballId, volleyballId, badmintonId, tabletennisId];

    // 2. จัดการรายการที่มีชื่อซ้ำกัน
    for (const item of STANDARD_EQUIPMENT) {
      const dups = await pool.query<{ id: number }>(
        'SELECT id FROM equipment WHERE name = $1 AND id <> $2',
        [item.name, canonicalMap.get(item.name)!]
      );
      for (const d of dups.rows) {
        await pool.query('UPDATE borrows SET equipment_id = $1 WHERE equipment_id = $2', [canonicalMap.get(item.name)!, d.id]);
        await pool.query('DELETE FROM equipment_items WHERE equipment_id = $1', [d.id]);
        await pool.query('DELETE FROM equipment WHERE id = $1', [d.id]);
      }
    }

    // 3. ย้ายข้อมูลประวัติการยืมของอุปกรณ์ขยะ / ทดสอบในอดีต เข้าสู่ 5 รายการหลักตามหมวดหมู่
    const obsoleteItems = await pool.query<{ id: number; name: string; category: string }>(
      `SELECT id, name, category FROM equipment WHERE id NOT IN (${standardIds.join(',')})`
    );

    for (const obs of obsoleteItems.rows) {
      let targetId = footballId;
      const lowerName = (obs.name || '').toLowerCase();
      const cat = obs.category || '';

      if (cat === 'บาสเกตบอล' || lowerName.includes('บาส') || lowerName.includes('basket')) {
        targetId = basketballId;
      } else if (cat === 'วอลเลย์บอล' || lowerName.includes('วอลเลย์') || lowerName.includes('volley')) {
        targetId = volleyballId;
      } else if (cat === 'แบดมินตัน' || lowerName.includes('แบด') || lowerName.includes('ขนไก่') || lowerName.includes('badminton')) {
        targetId = badmintonId;
      } else if (cat === 'เทเบิลเทนนิส' || lowerName.includes('ปิงปอง') || lowerName.includes('ping') || lowerName.includes('table')) {
        targetId = tabletennisId;
      }

      await pool.query('UPDATE borrows SET equipment_id = $1 WHERE equipment_id = $2', [targetId, obs.id]);
      await pool.query('DELETE FROM equipment_items WHERE equipment_id = $1', [obs.id]);
      await pool.query('DELETE FROM equipment WHERE id = $1', [obs.id]);
      console.log(`[Auto-Migration] Merged obsolete item "${obs.name}" (id: ${obs.id}) into canonical item id: ${targetId}`);
    }

    // 4. ล้าง equipment_items ตกค้าง
    await pool.query(`DELETE FROM equipment_items WHERE equipment_id NOT IN (${standardIds.join(',')})`);

    // 5. ซิงก์รหัสชิ้นอุปกรณ์และจำนวนคงเหลือใหม่
    await syncEquipmentItems(pool);
    console.log('[Auto-Migration] Equipment consolidation complete. Exactly 5 canonical items active.');
  } catch (err) {
    console.error('[Auto-Migration] Error consolidating equipment:', err);
  }
}

// Seed ข้อมูลเริ่มต้น (Admin, Student, และรายการอุปกรณ์กีฬาตัวอย่าง)
export async function seedInitialData(pool: Pool): Promise<void> {
  // 1. Admin เริ่มต้น (admin / admin1234)
  const adminExists = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE student_id = 'admin' OR LOWER(email) = 'admin@utcc.ac.th' LIMIT 1`
  );
  if (adminExists.rows.length === 0) {
    const adminPasswordHash = await bcrypt.hash('admin1234', 10);
    await pool.query(
      `INSERT INTO users (student_id, name, email, password_hash, role)
       VALUES ('admin', 'เจ้าหน้าที่ผู้ดูแลระบบ', 'admin@utcc.ac.th', $1, 'admin')
       ON CONFLICT (student_id) DO NOTHING`,
      [adminPasswordHash]
    );
    console.log('[Auto-Migration] Seeded admin: admin (admin@utcc.ac.th)');
  }

  // 2. นักศึกษาเริ่มต้น (2410511101055 / 123456)
  const studentExists = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE student_id = '2410511101055' LIMIT 1`
  );
  if (studentExists.rows.length === 0) {
    const studentHash = await bcrypt.hash('123456', 10);
    await pool.query(
      `INSERT INTO users (student_id, name, email, password_hash, role)
       VALUES ('2410511101055', 'นักศึกษา ทดสอบ', '2410511101055@utcc.ac.th', $1, 'student')
       ON CONFLICT (student_id) DO NOTHING`,
      [studentHash]
    );
    console.log('[Auto-Migration] Seeded student: 2410511101055');
  }

  // 3. จัดระเบียบและยุบรวมอุปกรณ์ให้ตรงกับ 5 รายการหลัก
  await consolidateEquipmentCatalog(pool);
}
