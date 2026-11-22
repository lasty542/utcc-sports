/**
 * โมดูลเชื่อมต่อฐานข้อมูล PostgreSQL (Connection Pool)
 */
import dotenv from 'dotenv';
import { Pool, types } from 'pg';
import { initDatabase, runAutoMigration } from './initDb';

dotenv.config();

// บันทึกฟิลด์ DATE เป็นข้อความ YYYY-MM-DD ตรงๆ ไม่เลื่อน Timezone
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

export { initDatabase, runAutoMigration, initDatabase as autoMigrateDatabase };
