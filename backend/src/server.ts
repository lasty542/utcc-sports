/**
 * จุดเริ่มต้นของเซิร์ฟเวอร์ Express API
 */
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { pool } from './config/db';
import { initDatabase } from './config/initDb';
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
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return origin === allowed || origin.replace(/\/+$/, '') === allowed.replace(/\/+$/, '');
        }
        return allowed.test(origin);
      });
      return callback(null, isAllowed ? true : true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json());

// Health Check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'up' });
  } catch {
    res.status(503).json({ ok: false, database: 'down' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equip', equipRoutes);
app.use('/api/equipment', equipRoutes);
app.use('/api/borrow', borrowRoutes);

// Error Handling
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

// เริ่มต้นฐานข้อมูลและรันเซิร์ฟเวอร์
async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy backend/.env.example to backend/.env');
  }

  try {
    console.log('Running auto-migration for PostgreSQL...');
    await initDatabase();
  } catch (error) {
    console.error('PostgreSQL migration warning. Check DATABASE_URL.');
    console.error(error);
  }

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

void main();
