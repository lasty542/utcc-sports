/**
 * โมดูลเชื่อมต่อและจัดการฐานข้อมูล PostgreSQL (Connection Pool, Schema และการ Seed ข้อมูลเริ่มต้น)
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool, types } from 'pg';

dotenv.config();

// Keep DATE columns as YYYY-MM-DD strings instead of timezone-shifted Date objects.
types.setTypeParser(1082, (value) => value);

const connectionString = process.env.DATABASE_URL;
const isNeonOrCloud = Boolean(
  connectionString?.includes('neon.tech') ||
  connectionString?.includes('render.com') ||
  connectionString?.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production'
);

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  ssl: isNeonOrCloud ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL client error', error);
});

// ผู้ช่วยรัน SQL ทีละคำสั่งแบบปลอดภัย หากติดขัดข้อจำกัดเดิมจะไม่หยุดการทำงาน
async function safeExecute(sql: string, description: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (err: any) {
    console.warn(`[Auto-Migration] Notice on "${description}": ${err?.message || err}`);
  }
}

// ฟังก์ชัน Auto-Migration ตรวจสอบและสร้างตาราง, คอลัมน์, ข้อจำกัด และดัชนีที่ระบบต้องการอัตโนมัติ
export async function autoMigrateDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log('[Auto-Migration] Starting PostgreSQL schema check and migration...');

  // 1. ตาราง users
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      student_id VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200),
      phone VARCHAR(30),
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
      auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
      otp_secret TEXT,
      otp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      reset_token_hash TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create users table');

  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);', 'users.email');
  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);', 'users.phone');
  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) NOT NULL DEFAULT \'local\';', 'users.auth_provider');
  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_secret TEXT;', 'users.otp_secret');
  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT FALSE;', 'users.otp_enabled');
  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;', 'users.reset_token_hash');
  await safeExecute('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;', 'users.reset_token_expires');

  // 2. ตาราง equipment
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS equipment (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      total_qty INTEGER NOT NULL DEFAULT 0 CHECK (total_qty >= 0),
      available_qty INTEGER NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
      image TEXT,
      icon VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'พร้อมใช้งาน',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create equipment table');

  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category VARCHAR(100);', 'equipment.category');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS description TEXT;', 'equipment.description');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS total_qty INTEGER NOT NULL DEFAULT 0;', 'equipment.total_qty');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS available_qty INTEGER NOT NULL DEFAULT 0;', 'equipment.available_qty');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image TEXT;', 'equipment.image');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS icon VARCHAR(100);', 'equipment.icon');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT \'พร้อมใช้งาน\';', 'equipment.status');

  // 3. ตาราง borrows
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS borrows (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      purpose TEXT,
      borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
      return_date DATE,
      time_slot VARCHAR(50),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      item_codes TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create borrows table');

  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS user_id INTEGER;', 'borrows.user_id');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS equipment_id INTEGER;', 'borrows.equipment_id');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;', 'borrows.quantity');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS purpose TEXT;', 'borrows.purpose');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS borrow_date DATE DEFAULT CURRENT_DATE;', 'borrows.borrow_date');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT (CURRENT_DATE + INTERVAL \'1 day\');', 'borrows.due_date');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS return_date DATE;', 'borrows.return_date');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS time_slot VARCHAR(50);', 'borrows.time_slot');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'pending\';', 'borrows.status');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS item_codes TEXT[] DEFAULT \'{}\';', 'borrows.item_codes');
  await safeExecute('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();', 'borrows.created_at');

  // ซ่อมแซมข้อมูลในกรณีที่ตารางเดิมมีฟิลด์ว่างหรือใช้ชื่อสลับกัน
  await safeExecute('UPDATE borrows SET due_date = return_date WHERE due_date IS NULL AND return_date IS NOT NULL;', 'repair due_date from return_date');
  await safeExecute('UPDATE borrows SET return_date = due_date WHERE return_date IS NULL AND due_date IS NOT NULL;', 'repair return_date from due_date');
  await safeExecute('UPDATE borrows SET borrow_date = CURRENT_DATE WHERE borrow_date IS NULL;', 'repair null borrow_date');
  await safeExecute('UPDATE borrows SET due_date = borrow_date + INTERVAL \'1 day\' WHERE due_date IS NULL;', 'repair null due_date');
  await safeExecute('UPDATE borrows SET item_codes = \'{}\' WHERE item_codes IS NULL;', 'repair null item_codes');
  await safeExecute('UPDATE borrows SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;', 'repair null quantity');

  // จัดการ Constraints ของ borrows
  await safeExecute('ALTER TABLE borrows DROP CONSTRAINT IF EXISTS borrows_status_check;', 'drop borrows_status_check');
  await safeExecute('ALTER TABLE borrows DROP CONSTRAINT IF EXISTS check_status;', 'drop check_status');
  await safeExecute(`
    ALTER TABLE borrows
    ADD CONSTRAINT borrows_status_check
    CHECK (status IN ('pending', 'approved', 'borrowing', 'borrowed', 'returned'));
  `, 'add borrows_status_check');

  // 4. ตาราง equipment_items (รหัสอุปกรณ์ประจำชิ้น Serial Tracking)
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS equipment_items (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      item_code VARCHAR(50) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'borrowed', 'damaged')),
      borrow_id INTEGER REFERENCES borrows(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create equipment_items table');

  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS equipment_id INTEGER;', 'equipment_items.equipment_id');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);', 'equipment_items.item_code');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'available\';', 'equipment_items.status');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS borrow_id INTEGER;', 'equipment_items.borrow_id');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();', 'equipment_items.created_at');

  // 5. ดัชนีเพื่อประสิทธิภาพ (Indexes)
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));', 'idx_users_email_lower');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);', 'idx_equipment_category');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_borrows_user_id ON borrows (user_id);', 'idx_borrows_user_id');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_borrows_status ON borrows (status);', 'idx_borrows_status');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_borrows_due_date ON borrows (due_date);', 'idx_borrows_due_date');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_equip_id ON equipment_items (equipment_id);', 'idx_equipment_items_equip_id');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items (status);', 'idx_equipment_items_status');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_borrow_id ON equipment_items (borrow_id);', 'idx_equipment_items_borrow_id');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_item_code ON equipment_items (item_code);', 'idx_equipment_items_item_code');

  console.log('[Auto-Migration] PostgreSQL schema and columns migrated successfully.');

  // 6. ซี้ดข้อมูลและสร้างรหัสอุปกรณ์รายชิ้น
  await seedInitialData();
  await syncEquipmentItems();
}

// เข้ากันได้กับโค้ดเดิมที่เรียก initDatabase()
export async function initDatabase(): Promise<void> {
  await autoMigrateDatabase();
}

// สร้างรหัสประจำชิ้น (Individual Asset / Serial Tracking) ให้สอดคล้องกับจำนวนอุปกรณ์
async function syncEquipmentItems(): Promise<void> {
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
      if (currentCount < eq.total_qty) {
        for (let i = 1; i <= eq.total_qty; i++) {
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

    // คำนวณจำนวนคงเหลือ (available_qty) จากรายการชิ้นที่สถานะ available
    await pool.query(`
      UPDATE equipment e
      SET available_qty = (
        SELECT COUNT(*)::int
        FROM equipment_items ei
        WHERE ei.equipment_id = e.id AND ei.status = 'available'
      )
    `);
    console.log('Synchronized equipment items serials successfully.');
  } catch (error) {
    console.error('Failed to sync equipment items:', error);
  }
}

// เพิ่มบัญชี Admin/นักศึกษาตัวอย่าง และรายการอุปกรณ์กีฬาเริ่มต้นหากยังไม่มีข้อมูล
async function seedInitialData(): Promise<void> {
  // 1. สร้างบัญชี Admin เริ่มต้น (admin@utcc.ac.th / admin1234) เฉพาะกรณีที่ยังไม่มีในระบบ
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
    console.log('Seeded initial admin account: admin (admin@utcc.ac.th)');
  }

  // 2. สร้างบัญชีนักศึกษาเริ่มต้น เฉพาะกรณีที่ยังไม่มีในระบบ (ไม่ทับรหัสผ่านของผู้ใช้เดิม)
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
    console.log('Seeded initial student account: 2410511101055 (2410511101055@utcc.ac.th)');
  }

  // 3. สร้างรายการอุปกรณ์กีฬาเริ่มต้นหากตาราง equipment ยังว่างอยู่
  const equipCount = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM equipment'
  );
  if ((equipCount.rows[0]?.count ?? 0) === 0) {
    await pool.query(
      `INSERT INTO equipment (name, category, description, total_qty, available_qty, image, status)
       VALUES
         ('ลูกฟุตบอล Molten No.5', 'ฟุตบอล', 'ลูกบอลหนังมาตรฐาน สำหรับใช้สนามหญ้าและสนามปูน', 10, 10, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
         ('ลูกบาสเกตบอล Spalding', 'บาสเกตบอล', 'ลูกบาสเกตบอลยางกันกระแทกอย่างดี สำหรับสนามกลางแจ้งและในร่ม', 8, 8, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
         ('ลูกวอลเลย์บอล Mikasa', 'วอลเลย์บอล', 'ลูกวอลเลย์บอลผิวสัมผัสนุ่ม ลดแรงกระแทกแขน', 6, 6, 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
         ('ชุดไม้แบดมินตัน Yonex (2 ไม้ + ลูก)', 'แบดมินตัน', 'ไม้แบดมินตันพร้อมลูกขนไก่ 1 ชุดประกอบด้วยไม้ 2 อัน', 12, 12, 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
         ('ชุดไม้ปิงปอง Butterfly (2 ไม้ + 3 ลูก)', 'เทเบิลเทนนิส', 'ไม้ปิงปองมาตรฐานพร้อมลูกปิงปอง 3 ดาว', 10, 10, 'https://images.unsplash.com/photo-1534158914592-062992fbe900?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน')`
    );
  }
}
