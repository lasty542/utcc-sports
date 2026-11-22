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

// สร้างตารางหลัก (users, equipment, borrows), Index และเรียก seed ข้อมูลเริ่มต้น
export async function initDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  await pool.query(`
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

    ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) NOT NULL DEFAULT 'local';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS equipment (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      total_qty INTEGER NOT NULL CHECK (total_qty >= 0),
      available_qty INTEGER NOT NULL CHECK (available_qty >= 0),
      image TEXT,
      icon VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'พร้อมใช้งาน',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT equipment_available_lte_total CHECK (available_qty <= total_qty)
    );

    CREATE TABLE IF NOT EXISTS borrows (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      purpose TEXT,
      borrow_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'borrowing', 'borrowed', 'returned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE borrows DROP CONSTRAINT IF EXISTS borrows_status_check;
    ALTER TABLE borrows ADD CONSTRAINT borrows_status_check CHECK (status IN ('pending', 'approved', 'borrowing', 'borrowed', 'returned'));

    CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);
    CREATE INDEX IF NOT EXISTS idx_borrows_user_id ON borrows (user_id);
    CREATE INDEX IF NOT EXISTS idx_borrows_status ON borrows (status);
  `);

  await seedInitialData();
}

// เพิ่มบัญชี Admin/นักศึกษาตัวอย่าง และรายการอุปกรณ์กีฬาเริ่มต้นหากยังไม่มีข้อมูล
async function seedInitialData(): Promise<void> {
  // 1. สร้าง/อัปเดตบัญชี Admin เริ่มต้น (admin@utcc.ac.th / admin1234)
  const adminPasswordHash = await bcrypt.hash('admin1234', 10);
  await pool.query(
    `INSERT INTO users (student_id, name, email, password_hash, role)
     VALUES ('admin', 'เจ้าหน้าที่ผู้ดูแลระบบ', 'admin@utcc.ac.th', $1, 'admin')
     ON CONFLICT (student_id) DO UPDATE 
     SET password_hash = EXCLUDED.password_hash,
         email = EXCLUDED.email,
         role = 'admin'`,
    [adminPasswordHash]
  );
  // ตรวจสอบและอัปเดตบัญชีอื่นที่ใช้อีเมล admin@utcc.ac.th ให้รหัสผ่านถูกต้องด้วย
  await pool.query(
    `UPDATE users 
     SET password_hash = $1, role = 'admin' 
     WHERE LOWER(email) = 'admin@utcc.ac.th' AND student_id != 'admin'`,
    [adminPasswordHash]
  );
  console.log('Seeded/Updated admin account: admin (admin@utcc.ac.th)');

  // 2. สร้าง/อัปเดตบัญชีนักศึกษาตัวอย่าง (2410511101055 / 123456)
  const studentHash = await bcrypt.hash('123456', 10);
  await pool.query(
    `INSERT INTO users (student_id, name, email, password_hash, role)
     VALUES ('2410511101055', 'นักศึกษา ทดสอบ', '2410511101055@utcc.ac.th', $1, 'student')
     ON CONFLICT (student_id) DO UPDATE 
     SET password_hash = EXCLUDED.password_hash,
         email = EXCLUDED.email,
         role = 'student'`,
    [studentHash]
  );
  // เผื่อมีบัญชีเดิมที่ใช้อีเมลหรือ student_id นี้
  await pool.query(
    `UPDATE users 
     SET password_hash = $1 
     WHERE student_id = '2410511101055' OR LOWER(email) = '2410511101055@utcc.ac.th'`,
    [studentHash]
  );
  console.log('Seeded/Updated student account: 2410511101055 (2410511101055@utcc.ac.th)');

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
