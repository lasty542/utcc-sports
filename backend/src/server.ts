/**
 * จุดเริ่มต้นของเซิร์ฟเวอร์ Express API (ตั้งค่า CORS, JSON, Routes และเริ่มรับการเชื่อมต่อ)
 */
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { initDatabase, pool } from './config/db';
import authRoutes from './routes/authRoutes';
import borrowRoutes from './routes/borrowRoutes';
import equipRoutes from './routes/equipRoutes';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
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

// เตรียมฐานข้อมูลและสั่งรัน HTTP Server บนพอร์ตที่กำหนด
async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy backend/.env.example to backend/.env');
  }

  try {
    await initDatabase();
    console.log('PostgreSQL schema is ready');
  } catch (error) {
    console.error('PostgreSQL is not ready. Check DATABASE_URL and that the database exists.');
    console.error(error);
  }

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

void main();
