/**
 * โมดูลจัดการการลงทะเบียน, เข้าสู่ระบบแบบรวมศูนย์ (Unified Login) และตรวจสอบข้อมูลผู้ใช้ปัจจุบัน
 */
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { pool } from '../../config/db';
import { readString } from '../../utils';
import {
  isAllowedEmail,
  signToken,
  toPublicUser,
  type UserRow,
  verifyAndUpgradePassword,
} from './authHelpers';

// สมัครสมาชิกใหม่ (รองรับการผูกบัญชีเดิมจาก Google OAuth อัตโนมัติ)
export async function register(req: Request, res: Response): Promise<void> {
  const studentId = readString(req.body?.studentId).trim();
  const name = readString(req.body?.name).trim();
  const email = readString(req.body?.email).trim().toLowerCase();
  const password = readString(req.body?.password);

  if (!studentId || !name || password.length < 6) {
    res.status(400).json({ message: 'กรอกรหัสนักศึกษา ชื่อ และรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    return;
  }

  if (!email || !isAllowedEmail(email)) {
    res.status(400).json({
      message: 'กรุณากรอกอีเมลให้ถูกต้อง (เช่น yourname@gmail.com, yourname@utcc.ac.th)',
    });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const role: UserRow['role'] = 'student';

    // 1. ตรวจสอบว่ามีบัญชีที่ใช้อีเมลนี้ในระบบอยู่แล้วหรือไม่
    const emailDup = await pool.query<UserRow>(
      `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
       FROM users
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       LIMIT 1`,
      [email]
    );

    if (emailDup.rows[0]) {
      const existing = emailDup.rows[0];
      const isSocial =
        existing.auth_provider === 'google' ||
        existing.student_id.startsWith('go-') ||
        existing.student_id === 'google-demo-user';

      if (isSocial) {
        const studentConflict = await pool.query<{ id: number }>(
          'SELECT id FROM users WHERE TRIM(student_id) = TRIM($1) AND id != $2 LIMIT 1',
          [studentId, existing.id]
        );
        if (studentConflict.rows[0]) {
          res.status(409).json({ message: 'รหัสนักศึกษานี้ถูกใช้งานโดยบัญชีอื่นแล้ว' });
          return;
        }

        const updated = await pool.query<UserRow>(
          `UPDATE users
           SET student_id = $1,
               name = $2,
               password_hash = $3
           WHERE id = $4
           RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
          [studentId, name, passwordHash, existing.id]
        );

        const linkedUser = updated.rows[0];
        res.status(200).json({
          token: signToken(linkedUser),
          user: toPublicUser(linkedUser),
          message: 'ผูกบัญชี Google กับรหัสนักศึกษาและรหัสผ่านเรียบร้อยแล้ว',
        });
        return;
      }

      res.status(409).json({
        message: 'อีเมลนี้ถูกใช้งานแล้ว สามารถเข้าสู่ระบบได้ทันที หรือใช้เมนูลืมรหัสผ่านเพื่อตั้งรหัสใหม่',
      });
      return;
    }

    // 2. ตรวจสอบว่ามีบัญชีที่ใช้รหัสนักศึกษานี้อยู่แล้วหรือไม่
    const studentDup = await pool.query<UserRow>(
      `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
       FROM users
       WHERE TRIM(student_id) = TRIM($1)
       LIMIT 1`,
      [studentId]
    );

    if (studentDup.rows[0]) {
      const existing = studentDup.rows[0];
      const isSocial =
        existing.auth_provider === 'google' ||
        existing.student_id.startsWith('go-') ||
        existing.student_id === 'google-demo-user';

      if (isSocial) {
        const updated = await pool.query<UserRow>(
          `UPDATE users
           SET email = $1,
               name = $2,
               password_hash = $3
           WHERE id = $4
           RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
          [email, name, passwordHash, existing.id]
        );
        const linkedUser = updated.rows[0];
        res.status(200).json({
          token: signToken(linkedUser),
          user: toPublicUser(linkedUser),
          message: 'อัปเดตข้อมูลบัญชีและรหัสผ่านเรียบร้อยแล้ว',
        });
        return;
      }

      res.status(409).json({
        message: 'รหัสนักศึกษานี้ถูกลงทะเบียนแล้ว หากลืมรหัสผ่านสามารถใช้เมนู "ลืมรหัสผ่าน" ได้ทันที',
      });
      return;
    }

    // 3. บันทึกบัญชีใหม่ลงฐานข้อมูล
    const result = await pool.query<UserRow>(
      `INSERT INTO users (student_id, name, email, password_hash, role, auth_provider)
       VALUES ($1, $2, $3, $4, $5, 'local')
       RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
      [studentId, name, email, passwordHash, role]
    );

    const user = result.rows[0];
    res.status(201).json({
      token: signToken(user),
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
}

// เข้าสู่ระบบด้วย Unified Login (รหัสนักศึกษา, อีเมล, หรือบัญชีผู้ดูแล)
export async function login(req: Request, res: Response): Promise<void> {
  const identifier = readString(
    req.body?.identifier ?? req.body?.studentId ?? req.body?.email ?? req.body?.username
  ).trim();
  const password = readString(req.body?.password);

  if (!identifier || !password) {
    res.status(400).json({ message: 'กรอกรหัสผู้ใช้และรหัสผ่าน' });
    return;
  }

  try {
    const result = await pool.query<UserRow>(
      `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
       FROM users
       WHERE TRIM(student_id) = TRIM($1)
          OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)))
       ORDER BY (TRIM(student_id) = TRIM($1)) DESC, id ASC
       LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];

    if (!user) {
      await bcrypt.hash(password, 10);
      res.status(401).json({ message: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    const passwordMatches = await verifyAndUpgradePassword(password, user.password_hash, user.id);

    if (!passwordMatches) {
      if (
        user.auth_provider === 'google' ||
        user.student_id.startsWith('go-')
      ) {
        res.status(401).json({
          message:
            'รหัสผ่านไม่ถูกต้อง (หากคุณสมัครผ่าน Google สามารถเข้าสู่ระบบด้วย Google หรือกด "ลืมรหัสผ่าน" เพื่อตั้งรหัสผ่านสำหรับล็อกอินด้วยรหัสนักศึกษาได้)',
        });
        return;
      }
      res.status(401).json({ message: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    res.json({ token: signToken(user), user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    const errMsg = error instanceof Error ? error.message : '';
    res.status(500).json({ message: `ไม่สามารถเข้าสู่ระบบได้ (${errMsg || 'unknown error'})` });
  }
}

// ดึงข้อมูลโปรไฟล์ของผู้ใช้งานที่เข้าสู่ระบบอยู่ปัจจุบัน
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  try {
    const result = await pool.query<UserRow>(
      `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' });
  }
}
