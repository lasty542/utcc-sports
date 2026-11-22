/**
 * โมดูล Auto-Migration และกำหนดค่าเริ่มต้นสำหรับฐานข้อมูล PostgreSQL
 */
import { pool } from './db';
import { seedInitialData } from './seedEquip';

// ฟังก์ชันช่วยรันคำสั่ง SQL อย่างปลอดภัย ไม่หยุดการทำงานแม้พบข้อจำกัดเดิม
async function safeExecute(sql: string, description: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Auto-Migration Notice] ${description}:`, msg);
  }
}

// ฟังก์ชันหลักรัน Schema Migration & Seeding
export async function initDatabase(): Promise<void> {
  console.log('[Auto-Migration] Initializing database schema...');

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
  `, 'create table users');
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
      total_qty INTEGER NOT NULL DEFAULT 10,
      available_qty INTEGER NOT NULL DEFAULT 10,
      image TEXT,
      icon VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'พร้อมใช้งาน',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table equipment');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category VARCHAR(100);', 'equipment.category');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS description TEXT;', 'equipment.description');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS total_qty INTEGER NOT NULL DEFAULT 10;', 'equipment.total_qty');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS available_qty INTEGER NOT NULL DEFAULT 10;', 'equipment.available_qty');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image TEXT;', 'equipment.image');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS icon VARCHAR(100);', 'equipment.icon');
  await safeExecute('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT \'พร้อมใช้งาน\';', 'equipment.status');

  // 3. ตาราง sports_equipment (Fallback)
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS sports_equipment (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      total_qty INTEGER NOT NULL DEFAULT 10,
      available_qty INTEGER NOT NULL DEFAULT 10,
      image TEXT,
      icon VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'พร้อมใช้งาน',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table sports_equipment');

  // 4. ตาราง borrows
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS borrows (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      purpose TEXT,
      borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
      return_date DATE,
      time_slot VARCHAR(50),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      item_codes TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table borrows');
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

  await safeExecute('UPDATE borrows SET due_date = return_date WHERE due_date IS NULL AND return_date IS NOT NULL;', 'borrows sync due_date');
  await safeExecute('UPDATE borrows SET return_date = due_date WHERE return_date IS NULL AND due_date IS NOT NULL;', 'borrows sync return_date');
  await safeExecute('UPDATE borrows SET borrow_date = CURRENT_DATE WHERE borrow_date IS NULL;', 'borrows default borrow_date');
  await safeExecute('UPDATE borrows SET due_date = borrow_date + INTERVAL \'1 day\' WHERE due_date IS NULL;', 'borrows default due_date');
  await safeExecute('UPDATE borrows SET item_codes = \'{}\' WHERE item_codes IS NULL;', 'borrows default item_codes');

  await safeExecute('ALTER TABLE borrows DROP CONSTRAINT IF EXISTS borrows_status_check;', 'drop constraint borrows_status_check');
  await safeExecute('ALTER TABLE borrows DROP CONSTRAINT IF EXISTS check_status;', 'drop constraint check_status');
  await safeExecute(`
    ALTER TABLE borrows
    ADD CONSTRAINT borrows_status_check
    CHECK (status IN ('pending', 'approved', 'borrowing', 'borrowed', 'returned'));
  `, 'add constraint borrows_status_check');

  // 5. ตาราง equipment_items (รหัสรายชิ้น EQ-xxx-yy)
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS equipment_items (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL,
      item_code VARCHAR(50) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'available',
      borrow_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table equipment_items');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS equipment_id INTEGER;', 'equipment_items.equipment_id');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);', 'equipment_items.item_code');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'available\';', 'equipment_items.status');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS borrow_id INTEGER;', 'equipment_items.borrow_id');
  await safeExecute('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();', 'equipment_items.created_at');

  // 6. ตารางสำรอง (borrow_items, borrow_requests)
  await safeExecute(`
    CREATE TABLE IF NOT EXISTS borrow_items (
      id SERIAL PRIMARY KEY,
      borrow_id INTEGER,
      equipment_id INTEGER,
      item_code VARCHAR(50),
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table borrow_items');

  await safeExecute(`
    CREATE TABLE IF NOT EXISTS borrow_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      equipment_id INTEGER,
      quantity INTEGER DEFAULT 1,
      purpose TEXT,
      borrow_date DATE DEFAULT CURRENT_DATE,
      due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table borrow_requests');

  // 7. Indexes
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_users_student_id ON users (student_id);', 'idx users student_id');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));', 'idx users email');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);', 'idx equipment category');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_borrows_user_id ON borrows (user_id);', 'idx borrows user_id');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_borrows_status ON borrows (status);', 'idx borrows status');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_borrows_due_date ON borrows (due_date);', 'idx borrows due_date');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_equip_id ON equipment_items (equipment_id);', 'idx equipment_items equip_id');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items (status);', 'idx equipment_items status');
  await safeExecute('CREATE INDEX IF NOT EXISTS idx_equipment_items_borrow_id ON equipment_items (borrow_id);', 'idx equipment_items borrow_id');

  // 8. Seeding & Synching
  await seedInitialData(pool);

  console.log('[Auto-Migration] PostgreSQL schema and auto-migration ready.');
}

export const runAutoMigration = initDatabase;
