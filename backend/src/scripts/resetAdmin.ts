/**
 * สคริปต์คำสั่งสำหรับสร้างหรือรีเซ็ตรหัสผ่านบัญชีผู้ดูแลระบบ (admin@utcc.ac.th / admin1234)
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { initDatabase, pool } from '../config/db';

dotenv.config();

// เชื่อมต่อฐานข้อมูลแล้วรีเซ็ตหรือสร้างบัญชี Admin จากนั้นปิด Pool
async function main(): Promise<void> {
  await initDatabase();

  const passwordHash = await bcrypt.hash('admin1234', 10);

  const existing = await pool.query<{ id: number; student_id: string }>(
    `SELECT id, student_id
     FROM users
     WHERE LOWER(email) = 'admin@utcc.ac.th' OR student_id = 'admin'
     ORDER BY (LOWER(email) = 'admin@utcc.ac.th') DESC, id ASC
     LIMIT 1`
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    await pool.query(
      `UPDATE users
       SET email = 'admin@utcc.ac.th',
           password_hash = $1,
           role = 'admin',
           otp_enabled = FALSE
       WHERE id = $2`,
      [passwordHash, row.id]
    );
    console.log(`Reset admin account: student_id=${row.student_id}, email=admin@utcc.ac.th, password=admin1234`);
  } else {
    await pool.query(
      `INSERT INTO users (student_id, name, email, password_hash, role)
       VALUES ('admin', 'เจ้าหน้าที่ผู้ดูแลระบบ', 'admin@utcc.ac.th', $1, 'admin')`,
      [passwordHash]
    );
    console.log('Created admin account: student_id=admin, email=admin@utcc.ac.th, password=admin1234');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('Failed to reset admin account:', err);
  await pool.end();
  process.exit(1);
});
