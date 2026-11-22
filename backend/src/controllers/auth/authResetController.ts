/**
 * โมดูลจัดการการรีเซ็ตรหัสผ่าน (Instant Password Reset และ Token-based Reset)
 */
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { pool } from '../../config/db';
import { readString } from '../../utils';

// ส่งคำขอรีเซ็ตรหัสผ่าน (แนะนำให้ใช้ Instant Password Reset)
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const email = readString(req.body?.email).trim().toLowerCase();
  if (!email) {
    res.status(400).json({ message: 'กรุณากรอกอีเมล' });
    return;
  }
  // ตอบกลับอย่างปลอดภัยและแนะนำ Instant Password Reset
  res.json({
    emailSent: false,
    message: 'ระบบรองรับการตั้งรหัสผ่านใหม่ทันทีผ่านหน้าต่าง "ลืมรหัสผ่าน" บนหน้าเข้าสู่ระบบ',
  });
}

// ตรวจสอบโทเคนรีเซ็ตและบันทึกรหัสผ่านใหม่ลงฐานข้อมูล
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const token = readString(req.body?.token);
  const newPassword = readString(req.body?.newPassword);

  if (!token || newPassword.length < 6) {
    res.status(400).json({ message: 'โทเคนไม่ถูกต้องหรือรหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    return;
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const found = await pool.query<{ id: number }>(
      `SELECT id
       FROM users
       WHERE reset_token_hash = $1
         AND reset_token_expires > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    const user = found.rows[0];

    if (!user) {
      res.status(400).json({ message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expires = NULL
       WHERE id = $2`,
      [newHash, user.id]
    );

    res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้ทันที' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถตั้งรหัสผ่านใหม่ได้' });
  }
}

// ตรวจสอบตัวตนผู้ใช้ (ขั้นตอนที่ 1 ของ Instant Password Reset)
export async function verifyResetIdentity(req: Request, res: Response): Promise<void> {
  const email = readString(req.body?.email).trim().toLowerCase();
  const studentId = readString(req.body?.studentId).trim();

  if (!email && !studentId) {
    res.status(400).json({ message: 'กรุณากรอกอีเมลหรือรหัสนักศึกษา' });
    return;
  }

  try {
    const exactMatch = await pool.query<{ id: number; name: string; student_id: string; email: string }>(
      `SELECT id, name, student_id, email FROM users
       WHERE (LOWER(TRIM(email)) = LOWER(TRIM($1)) OR TRIM(student_id) = TRIM($1))
         AND (TRIM(student_id) = TRIM($2) OR LOWER(TRIM(email)) = LOWER(TRIM($2)))
       LIMIT 1`,
      [email || studentId, studentId || email]
    );

    if (exactMatch.rows[0]) {
      const user = exactMatch.rows[0];
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      await pool.query(
        `UPDATE users
         SET reset_token_hash = $1,
             reset_token_expires = NOW() + INTERVAL '15 minutes'
         WHERE id = $2`,
        [tokenHash, user.id]
      );

      res.json({
        success: true,
        token: rawToken,
        name: user.name,
        studentId: user.student_id,
        email: user.email,
        message: `ยืนยันตัวตนสำเร็จ (${user.name}) กรุณาตั้งรหัสผ่านใหม่`,
      });
      return;
    }

    if (email) {
      const matchByEmail = await pool.query<{
        id: number;
        name: string;
        email: string;
        student_id: string;
      }>(
        `SELECT id, name, email, student_id FROM users
         WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
         LIMIT 1`,
        [email]
      );

      if (matchByEmail.rows[0]) {
        const u = matchByEmail.rows[0];
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        if (studentId && !studentId.startsWith('go-') && studentId !== email) {
          await pool.query(
            `UPDATE users
             SET student_id = $1,
                 reset_token_hash = $2,
                 reset_token_expires = NOW() + INTERVAL '15 minutes'
             WHERE id = $3`,
            [studentId, tokenHash, u.id]
          );
        } else {
          await pool.query(
            `UPDATE users
             SET reset_token_hash = $1,
                 reset_token_expires = NOW() + INTERVAL '15 minutes'
             WHERE id = $2`,
            [tokenHash, u.id]
          );
        }

        res.json({
          success: true,
          token: rawToken,
          name: u.name,
          studentId: studentId && !studentId.startsWith('go-') ? studentId : u.student_id,
          email: u.email,
          message: `ยืนยันตัวตนสำเร็จ (${u.name}) กรุณาตั้งรหัสผ่านใหม่`,
        });
        return;
      }
    }

    if (studentId) {
      const matchByStudentId = await pool.query<{ id: number; name: string; email: string; student_id: string }>(
        `SELECT id, name, email, student_id FROM users
         WHERE TRIM(student_id) = TRIM($1)
         LIMIT 1`,
        [studentId]
      );

      if (matchByStudentId.rows[0]) {
        const user = matchByStudentId.rows[0];
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        await pool.query(
          `UPDATE users
           SET reset_token_hash = $1,
               reset_token_expires = NOW() + INTERVAL '15 minutes'
           WHERE id = $2`,
          [tokenHash, user.id]
        );

        res.json({
          success: true,
          token: rawToken,
          name: user.name,
          studentId: user.student_id,
          email: user.email,
          message: `ยืนยันตัวตนสำเร็จ (${user.name}) กรุณาตั้งรหัสผ่านใหม่`,
        });
        return;
      }
    }

    res.status(404).json({
      message: 'ไม่พบข้อมูลรหัสนักศึกษาหรืออีเมลนี้ในระบบ กรุณาตรวจสอบข้อมูลหรือสมัครสมาชิกใหม่',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล กรุณาลองใหม่' });
  }
}

// บันทึกรหัสผ่านใหม่ทันที (ขั้นตอนที่ 2 ของ Instant Password Reset)
export async function instantResetPassword(req: Request, res: Response): Promise<void> {
  const token = readString(req.body?.token).trim();
  const email = readString(req.body?.email).trim().toLowerCase();
  const studentId = readString(req.body?.studentId).trim();
  const newPassword = readString(req.body?.newPassword);

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    return;
  }

  try {
    let userId: number | null = null;

    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const found = await pool.query<{ id: number }>(
        `SELECT id FROM users
         WHERE reset_token_hash = $1 AND reset_token_expires > NOW()
         LIMIT 1`,
        [tokenHash]
      );
      if (found.rows[0]) {
        userId = found.rows[0].id;
      }
    }

    if (!userId && (email || studentId)) {
      const found = await pool.query<{ id: number }>(
        `SELECT id FROM users
         WHERE (LOWER(TRIM(email)) = LOWER(TRIM($1)) AND $1 != '')
            OR (TRIM(student_id) = TRIM($2) AND $2 != '')
         LIMIT 1`,
        [email, studentId]
      );
      if (found.rows[0]) {
        userId = found.rows[0].id;
      }
    }

    if (!userId) {
      res.status(400).json({
        message: 'การยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว กรุณาย้อนกลับไปตรวจสอบข้อมูลใหม่อีกครั้ง',
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expires = NULL
       WHERE id = $2`,
      [newHash, userId]
    );

    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
  }
}
