/**
 * โมดูลจัดการโปรไฟล์ผู้ใช้, เปลี่ยนรหัสผ่าน และการตั้งค่า 2FA (TOTP)
 */
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { pool } from '../../config/db';
import { readString } from '../../utils';
import {
  toPublicUser,
  type UserRow,
  verifyAndUpgradePassword,
} from './authHelpers';

// สร้าง Secret และ URI สำหรับตั้งค่า 2FA (TOTP) บนแอป Authenticator
export async function setupOtp(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: 'UTCC Sports',
    label: req.user.studentId,
    secret,
  });

  try {
    await pool.query(
      `UPDATE users
       SET otp_secret = $1, otp_enabled = FALSE
       WHERE id = $2`,
      [secret, req.user.id]
    );

    res.json({ secret, otpauthUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถตั้งค่า OTP ได้' });
  }
}

// ยืนยันรหัส OTP 6 หลักเพื่อเปิดใช้งาน 2FA ให้บัญชีผู้ใช้
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const token = readString(req.body?.otp ?? req.body?.token);
  if (!token) {
    res.status(400).json({ message: 'กรอกรหัส OTP' });
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

    if (!user?.otp_secret) {
      res.status(400).json({ message: 'ยังไม่ได้เริ่มตั้งค่า OTP' });
      return;
    }

    const otpValid = verifySync({ token, secret: user.otp_secret }).valid;
    if (!otpValid) {
      res.status(401).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
      return;
    }

    await pool.query('UPDATE users SET otp_enabled = TRUE WHERE id = $1', [user.id]);
    res.json({ otpEnabled: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถยืนยัน OTP ได้' });
  }
}

// ปิดใช้งาน 2FA และล้างค่า OTP Secret ของผู้ใช้
export async function disableOtp(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  try {
    await pool.query(
      'UPDATE users SET otp_enabled = FALSE, otp_secret = NULL WHERE id = $1',
      [req.user.id]
    );
    res.json({ otpEnabled: false, message: 'ปิดใช้งานการยืนยันตัวตน 2 ขั้นตอนเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถปิดใช้งาน OTP ได้' });
  }
}

// เปลี่ยนรหัสผ่านใหม่ (รองรับกรณีผู้ใช้ลงทะเบียนผ่าน Social หรือตั้งรหัสผ่านใหม่)
export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const currentPassword = readString(req.body?.currentPassword);
  const newPassword = readString(req.body?.newPassword);

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    return;
  }

  try {
    const result = await pool.query<{ id: number; password_hash: string; auth_provider: string }>(
      'SELECT id, password_hash, auth_provider FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }

    const isSocial =
      user.auth_provider === 'google' ||
      req.user.studentId.startsWith('go-') ||
      req.user.studentId === 'google-demo-user';

    if (!isSocial) {
      if (!currentPassword) {
        res.status(400).json({ message: 'กรุณากรอกรหัสผ่านปัจจุบัน' });
        return;
      }
      const matches = await verifyAndUpgradePassword(currentPassword, user.password_hash, user.id);
      if (!matches) {
        res.status(401).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        return;
      }
      if (currentPassword === newPassword) {
        res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' });
        return;
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    res.json({
      message: isSocial
        ? 'ตั้งรหัสผ่านสำเร็จ สามารถนำรหัสนักศึกษาและรหัสผ่านนี้ไปเข้าสู่ระบบได้ทันที'
        : 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
  }
}

// อัปเดตข้อมูลโปรไฟล์ (อีเมล, เบอร์โทร, ผูกรหัสนักศึกษาจริง และตั้งรหัสผ่าน)
export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const email = readString(req.body?.email).trim().toLowerCase();
  const phone = readString(req.body?.phone).trim();
  const studentId = readString(req.body?.studentId).trim();
  const newPassword = readString(req.body?.newPassword);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    return;
  }

  try {
    if (studentId) {
      const conflict = await pool.query<{ id: number }>(
        'SELECT id FROM users WHERE TRIM(student_id) = TRIM($1) AND id != $2 LIMIT 1',
        [studentId, req.user.id]
      );
      if (conflict.rows[0]) {
        res.status(409).json({ message: 'รหัสนักศึกษานี้ถูกใช้งานโดยบัญชีอื่นแล้ว' });
        return;
      }
    }

    const queryParams: unknown[] = [email || null, phone || null];
    let queryIdx = 3;
    let updateFields = 'email = $1, phone = $2';

    if (studentId) {
      updateFields += `, student_id = $${queryIdx}`;
      queryParams.push(studentId);
      queryIdx++;
    }

    if (newPassword && newPassword.length >= 6) {
      const hash = await bcrypt.hash(newPassword, 10);
      updateFields += `, password_hash = $${queryIdx}`;
      queryParams.push(hash);
      queryIdx++;
    }

    queryParams.push(req.user.id);

    const updated = await pool.query<UserRow>(
      `UPDATE users
       SET ${updateFields}
       WHERE id = $${queryIdx}
       RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
      queryParams
    );

    const user = updated.rows[0];
    if (!user) {
      res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }

    res.json({ message: 'อัปเดตข้อมูลบัญชีเรียบร้อยแล้ว', user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลบัญชีได้' });
  }
}
