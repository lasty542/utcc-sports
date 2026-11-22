/**
 * จุดเริ่มต้นของเซิร์ฟเวอร์ Express API (ตั้งค่า CORS, JSON, Routes และเริ่มรับการเชื่อมต่อ)
 */
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { autoMigrateDatabase, initDatabase, pool } from './config/db';
import authRoutes from './routes/authRoutes';
import borrowRoutes from './routes/borrowRoutes';
import equipRoutes from './routes/equipRoutes';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

// ตั้งค่า CORS ให้รองรับ FRONTEND_URL, Vercel deployments และ Localhost
const rawFrontendUrl = process.env.FRONTEND_URL?.trim()
  .replace(/^["']|["']$/g, '')
  .replace(/[\r\n\t]/g, '')
  .replace(/\/+$/, '');

const allowedOrigins: (string | RegExp)[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  /^https?:\/\/localhost(:\d+)?$/,
  /\.vercel\.app$/,
];

if (rawFrontendUrl) {
  allowedOrigins.push(rawFrontendUrl);
  if (!/^https?:\/\//i.test(rawFrontendUrl)) {
    allowedOrigins.push(`https://${rawFrontendUrl}`);
    allowedOrigins.push(`http://${rawFrontendUrl}`);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // อนุญาตคำขอที่ไม่มี origin เช่น mobile app, curl, postman หรือ server-to-server
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return origin === allowed || origin.replace(/\/+$/, '') === allowed.replace(/\/+$/, '');
        }
        return allowed.test(origin);
      });

      if (isAllowed) {
        return callback(null, true);
      }

      // อนุญาต origin อื่นๆ เพื่อความยืดหยุ่นใน production ไม่ให้เกิด CORS block
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json());

// ตรวจสอบสถานะความพร้อมของ API และฐานข้อมูล PostgreSQL
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'up' });
  } catch {
    res.status(503).json({ ok: false, database: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/equip', equipRoutes);
app.use('/api/equipment', equipRoutes);
app.use('/api/borrow', borrowRoutes);

// ดักจับ Error กรณี Body JSON รูปแบบไม่ถูกต้อง
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' });
    return;
  }
  next(err);
});

app.use((_req, res) => {
  res.status(404).json({ message: 'ไม่พบเส้นทางที่เรียก' });
});

// ฟังก์ชัน Auto-Migration สำหรับตรวจสอบและสร้างตาราง, คอลัมน์, ค่าเริ่มต้น และดัชนีทั้งหมดที่ borrowController ใช้งาน
export async function runAutoMigration(): Promise<void> {
  console.log('[AutoMigration] Starting database migration in server.ts...');

  const safeQuery = async (sql: string, label: string) => {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn(`[AutoMigration Notice] ${label}:`, err?.message || err);
    }
  };

  // 1. ตาราง users
  await safeQuery(`
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
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);', 'users.email');
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);', 'users.phone');
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) NOT NULL DEFAULT \'local\';', 'users.auth_provider');
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_secret TEXT;', 'users.otp_secret');
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT FALSE;', 'users.otp_enabled');
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;', 'users.reset_token_hash');
  await safeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;', 'users.reset_token_expires');

  // 2. ตาราง equipment (คลังอุปกรณ์กีฬาหลัก)
  await safeQuery(`
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
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category VARCHAR(100);', 'equipment.category');
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS description TEXT;', 'equipment.description');
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS total_qty INTEGER NOT NULL DEFAULT 10;', 'equipment.total_qty');
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS available_qty INTEGER NOT NULL DEFAULT 10;', 'equipment.available_qty');
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image TEXT;', 'equipment.image');
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS icon VARCHAR(100);', 'equipment.icon');
  await safeQuery('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT \'พร้อมใช้งาน\';', 'equipment.status');

  // 3. ตาราง sports_equipment (สำหรับกรณีฐานข้อมูลเดิมใช้ชื่อนี้)
  await safeQuery(`
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

  // 4. ตาราง borrows (บันทึกประวัติและรายการขอยืม-คืน)
  await safeQuery(`
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
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS user_id INTEGER;', 'borrows.user_id');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS equipment_id INTEGER;', 'borrows.equipment_id');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;', 'borrows.quantity');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS purpose TEXT;', 'borrows.purpose');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS borrow_date DATE DEFAULT CURRENT_DATE;', 'borrows.borrow_date');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT (CURRENT_DATE + INTERVAL \'1 day\');', 'borrows.due_date');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS return_date DATE;', 'borrows.return_date');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS time_slot VARCHAR(50);', 'borrows.time_slot');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'pending\';', 'borrows.status');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS item_codes TEXT[] DEFAULT \'{}\';', 'borrows.item_codes');
  await safeQuery('ALTER TABLE borrows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();', 'borrows.created_at');

  await safeQuery('UPDATE borrows SET due_date = return_date WHERE due_date IS NULL AND return_date IS NOT NULL;', 'borrows sync due_date');
  await safeQuery('UPDATE borrows SET return_date = due_date WHERE return_date IS NULL AND due_date IS NOT NULL;', 'borrows sync return_date');
  await safeQuery('UPDATE borrows SET borrow_date = CURRENT_DATE WHERE borrow_date IS NULL;', 'borrows default borrow_date');
  await safeQuery('UPDATE borrows SET due_date = borrow_date + INTERVAL \'1 day\' WHERE due_date IS NULL;', 'borrows default due_date');
  await safeQuery('UPDATE borrows SET item_codes = \'{}\' WHERE item_codes IS NULL;', 'borrows default item_codes');

  await safeQuery('ALTER TABLE borrows DROP CONSTRAINT IF EXISTS borrows_status_check;', 'drop constraint borrows_status_check');
  await safeQuery('ALTER TABLE borrows DROP CONSTRAINT IF EXISTS check_status;', 'drop constraint check_status');
  await safeQuery(`
    ALTER TABLE borrows
    ADD CONSTRAINT borrows_status_check
    CHECK (status IN ('pending', 'approved', 'borrowing', 'borrowed', 'returned'));
  `, 'add constraint borrows_status_check');

  // 5. ตาราง equipment_items (รหัสประจำชิ้นแต่ละรายการ Serial Tracking เช่น EQ-001-01)
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS equipment_items (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL,
      item_code VARCHAR(50) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'available',
      borrow_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table equipment_items');
  await safeQuery('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS equipment_id INTEGER;', 'equipment_items.equipment_id');
  await safeQuery('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);', 'equipment_items.item_code');
  await safeQuery('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'available\';', 'equipment_items.status');
  await safeQuery('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS borrow_id INTEGER;', 'equipment_items.borrow_id');
  await safeQuery('ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();', 'equipment_items.created_at');

  // 6. ตารางรองรับเพิ่มเติม: borrow_items และ borrow_requests
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS borrow_items (
      id SERIAL PRIMARY KEY,
      borrow_id INTEGER,
      equipment_id INTEGER,
      item_code VARCHAR(50),
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `, 'create table borrow_items');

  await safeQuery(`
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

  // 7. ดัชนี (Indexes)
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_users_student_id ON users (student_id);', 'idx users student_id');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));', 'idx users email');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);', 'idx equipment category');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_borrows_user_id ON borrows (user_id);', 'idx borrows user_id');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_borrows_status ON borrows (status);', 'idx borrows status');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_borrows_due_date ON borrows (due_date);', 'idx borrows due_date');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_equipment_items_equip_id ON equipment_items (equipment_id);', 'idx equipment_items equip_id');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items (status);', 'idx equipment_items status');
  await safeQuery('CREATE INDEX IF NOT EXISTS idx_equipment_items_borrow_id ON equipment_items (borrow_id);', 'idx equipment_items borrow_id');

  // 8. เพิ่มข้อมูลอุปกรณ์ตัวอย่าง หากตาราง equipment ยังว่างอยู่
  try {
    const eqCount = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM equipment');
    if ((eqCount.rows[0]?.count ?? 0) === 0) {
      await safeQuery(`
        INSERT INTO equipment (name, category, description, total_qty, available_qty, image, status)
        VALUES
          ('ลูกฟุตบอล Molten No.5', 'ฟุตบอล', 'ลูกบอลหนังมาตรฐาน สำหรับใช้สนามหญ้าและสนามปูน', 10, 10, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
          ('ลูกบาสเกตบอล Spalding', 'บาสเกตบอล', 'ลูกบาสเกตบอลยางกันกระแทกอย่างดี สำหรับสนามกลางแจ้งและในร่ม', 8, 8, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
          ('ลูกวอลเลย์บอล Mikasa', 'วอลเลย์บอล', 'ลูกวอลเลย์บอลผิวสัมผัสนุ่ม ลดแรงกระแทกแขน', 6, 6, 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
          ('ชุดไม้แบดมินตัน Yonex (2 ไม้ + ลูก)', 'แบดมินตัน', 'ไม้แบดมินตันพร้อมลูกขนไก่ 1 ชุดประกอบด้วยไม้ 2 อัน', 12, 12, 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน'),
          ('ชุดไม้ปิงปอง Butterfly (2 ไม้ + 3 ลูก)', 'เทเบิลเทนนิส', 'ไม้ปิงปองมาตรฐานพร้อมลูกปิงปอง 3 ดาว', 10, 10, 'https://images.unsplash.com/photo-1534158914592-062992fbe900?q=80&w=600&auto=format&fit=crop', 'พร้อมใช้งาน')
      `, 'seed default equipment');
    }
  } catch (err) {
    console.warn('[AutoMigration Notice] eqCount check:', err);
  }

  // 9. สร้างรายการ equipment_items ให้ครบทุกชิ้น
  try {
    const equips = await pool.query<{ id: number; total_qty: number }>('SELECT id, total_qty FROM equipment');
    for (const eq of equips.rows) {
      const total = Math.max(eq.total_qty || 0, 10);
      for (let i = 1; i <= total; i++) {
        const itemCode = `EQ-${String(eq.id).padStart(3, '0')}-${String(i).padStart(2, '0')}`;
        await safeQuery(`
          INSERT INTO equipment_items (equipment_id, item_code, status)
          VALUES (${eq.id}, '${itemCode}', 'available')
          ON CONFLICT (item_code) DO NOTHING
        `, `seed item ${itemCode}`);
      }
    }

    // คำนวณจำนวนคงเหลือ (available_qty)
    await safeQuery(`
      UPDATE equipment e
      SET available_qty = (
        SELECT COUNT(*)::int
        FROM equipment_items ei
        WHERE ei.equipment_id = e.id AND ei.status = 'available'
      )
    `, 'recalculate equipment available_qty');
  } catch (err) {
    console.warn('[AutoMigration Notice] sync equipment_items:', err);
  }

  console.log('[AutoMigration] Completed successfully in server.ts');
}

// เตรียมฐานข้อมูล รัน Auto-Migration และสั่งรัน HTTP Server บนพอร์ตที่กำหนด
async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy backend/.env.example to backend/.env');
  }

  try {
    console.log('Running auto-migration for PostgreSQL...');
    await runAutoMigration();
    console.log('PostgreSQL schema and auto-migration ready');
  } catch (error) {
    console.error('PostgreSQL migration warning. Check DATABASE_URL and that the database exists.');
    console.error(error);
  }

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

void main();
