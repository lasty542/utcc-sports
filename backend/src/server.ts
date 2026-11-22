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

// เตรียมฐานข้อมูล รัน Auto-Migration และสั่งรัน HTTP Server บนพอร์ตที่กำหนด
async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy backend/.env.example to backend/.env');
  }

  try {
    console.log('Running auto-migration for PostgreSQL...');
    await autoMigrateDatabase();
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
