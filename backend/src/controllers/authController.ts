/**
 * ตัวควบคุม (Controller) จัดการการยืนยันตัวตน, สมัครสมาชิก, รีเซ็ตรหัสผ่าน, OTP และ Microsoft OAuth
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { pool } from '../config/db';
import type { AuthPayload } from '../middlewares/authMiddleware';
import { readString, sendMail } from '../utils';

interface UserRow {
  id: number;
  student_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  role: 'student' | 'admin';
  auth_provider?: string;
  otp_secret: string | null;
  otp_enabled: boolean;
}

// แปลงข้อมูลผู้ใช้จากแถวฐานข้อมูลให้เป็นรูปแบบปลอดภัยสำหรับส่งกลับ Client (ตัดรหัสผ่านออก)
function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    studentId: user.student_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    authProvider: user.auth_provider || 'local',
    otpEnabled: user.otp_enabled,
  };
}

// อ่านรายชื่อโดเมนอีเมลที่อนุญาตจากตัวแปรแวดล้อม (หากเป็น * หรือเว้นว่าง จะอนุญาตทุกอีเมล)
function getAllowedEmailDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS || '*';
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

// ตรวจสอบความถูกต้องของอีเมล (อนุญาตอีเมลทั่วไป เช่น @gmail.com, @hotmail.com หรือ @utcc.ac.th)
function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  const allowed = getAllowedEmailDomains();
  if (allowed.length === 0 || allowed.includes('*')) return true;
  const domain = normalized.split('@')[1] || '';
  return allowed.some(
    (a) => domain === a || domain.endsWith(`.${a}`)
  );
}

// รักษาความเข้ากันได้แบบเดิม
function isUniversityEmail(email: string): boolean {
  return isAllowedEmail(email);
}

// ดึง URL หลักของ Frontend และทำความสะอาดค่าอย่างปลอดภัย (ป้องกัน ERR_INVALID_REDIRECT)
function getFrontendUrl(customBase?: string): string {
  let raw = (customBase || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  // ลบ single/double quotes ถ้ามี
  raw = raw.replace(/^["']|["']$/g, '').trim();
  // ตัดอักขระควบคุมช่องว่างและขึ้นบรรทัดใหม่ เช่น \r \n \t
  raw = raw.replace(/[\r\n\t]/g, '').trim();
  // หากไม่มีโปรโตคอล http:// หรือ https:// ให้เติม https:// นำหน้าเสมอ
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/+$/, '');
}

// สร้าง Safe Redirect URL ไปยัง Frontend โดยใช้คลาส URL ตามมาตรฐาน W3C/RFC 3986
function buildFrontendRedirectUrl(
  path: string,
  params?: Record<string, string | undefined>,
  customBase?: string
): string {
  const base = getFrontendUrl(customBase);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * ส่งการนำทางอย่างปลอดภัยไปยังเบราว์เซอร์ เพื่อป้องกันข้อผิดพลาด ERR_INVALID_REDIRECT ใน Chrome
 * โดยส่ง HTTP 200 พร้อม meta refresh และ JavaScript window.location.replace
 */
function sendSafeRedirect(res: Response, targetUrl: string): void {
  const safeTargetUrl = targetUrl.replace(/"/g, '&quot;');
  res.status(200).send(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${safeTargetUrl}">
  <title>กำลังเปลี่ยนเส้นทาง...</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .box { text-align: center; padding: 2rem; background: #ffffff; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 440px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #0f172a; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    a { color: #0284c7; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">กำลังนำท่านกลับสู่ระบบ UTCC Sport...</h2>
    <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 1.25rem;">หากระบบไม่เปลี่ยนหน้าอัตโนมัติ กรุณาคลิกลิงก์ด้านล่าง</p>
    <a href="${safeTargetUrl}">คลิกที่นี่เพื่อดำเนินการต่อ &rarr;</a>
  </div>
  <script>
    try {
      window.location.replace(${JSON.stringify(targetUrl)});
    } catch (e) {
      window.location.href = ${JSON.stringify(targetUrl)};
    }
  </script>
</body>
</html>`);
}

// สร้าง JWT Token อายุ 7 วันสำหรับผู้ใช้งาน
function signToken(user: UserRow): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  const payload: AuthPayload = {
    id: user.id,
    studentId: user.student_id,
    role: user.role,
    name: user.name,
  };

  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

// สมัครสมาชิกใหม่ (จำกัดให้สมัครได้เฉพาะบทบาท student เท่านั้น)
export async function register(req: Request, res: Response): Promise<void> {
  const studentId = readString(req.body?.studentId);
  const name = readString(req.body?.name);
  const email = readString(req.body?.email).toLowerCase();
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
    const emailDup = await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );
    if (emailDup.rows.length > 0) {
      res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
      return;
    }

    // สมัครสมาชิกใหม่จะได้รับสิทธิ์ student เท่านั้น ส่วน admin ต้องสร้างจากฐานข้อมูลหรือระบบ
    const role: UserRow['role'] = 'student';
    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await pool.query<UserRow>(
      `INSERT INTO users (student_id, name, email, password_hash, role, auth_provider)
       VALUES ($1, $2, $3, $4, $5, 'local')
       RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
      [studentId, name, email, passwordHash, role]
    );

    const user = inserted.rows[0];
    if (!user) {
      res.status(500).json({ message: 'สร้างบัญชีไม่สำเร็จ' });
      return;
    }

    res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      res.status(409).json({ message: 'รหัสนักศึกษาหรืออีเมลนี้ถูกใช้งานแล้ว' });
      return;
    }

    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถสมัครสมาชิกได้' });
  }
}

// เข้าสู่ระบบด้วยรหัสนักศึกษา/บัญชีเจ้าหน้าที่ หรืออีเมล และตรวจสอบรหัสผ่าน
export async function login(req: Request, res: Response): Promise<void> {
  const identifier = readString(req.body?.identifier ?? req.body?.studentId);
  const password = readString(req.body?.password);

  if (!identifier || !password) {
    res.status(400).json({ message: 'กรอกรหัสผู้ใช้และรหัสผ่าน' });
    return;
  }

  try {
    const result = await pool.query<UserRow>(
      `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
       FROM users
       WHERE student_id = $1
          OR (email IS NOT NULL AND LOWER(email) = LOWER($1))
       ORDER BY (student_id = $1) DESC, id ASC
       LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];

    if (!user) {
      await bcrypt.hash(password, 10);
      res.status(401).json({ message: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    const passwordMatches =
      typeof user.password_hash === 'string' && user.password_hash.length > 0
        ? await bcrypt.compare(password, user.password_hash)
        : false;
    if (!passwordMatches) {
      res.status(401).json({ message: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    res.json({ token: signToken(user), user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    const pgCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    const errMsg = error instanceof Error ? error.message : '';

    if (pgCode === 'ECONNREFUSED') {
      res.status(500).json({ message: 'เชื่อมต่อ PostgreSQL ไม่ได้ (กรุณาเปิดบริการ PostgreSQL)' });
      return;
    }
    if (pgCode === '3D000') {
      res.status(500).json({ message: 'ไม่พบฐานข้อมูล utcc_sports ใน PostgreSQL (กรุณาสร้างฐานข้อมูลก่อน)' });
      return;
    }
    if (pgCode === '28P01') {
      res.status(500).json({ message: 'รหัสผ่าน PostgreSQL ในไฟล์ backend/.env ไม่ถูกต้อง' });
      return;
    }
    if (pgCode === '42P01' || pgCode === '42703') {
      res.status(500).json({ message: `โครงสร้างตารางใน PostgreSQL ยังไม่พร้อม (${pgCode}: ${errMsg})` });
      return;
    }
    if (errMsg.includes('JWT_SECRET')) {
      res.status(500).json({ message: 'ยังไม่ได้ตั้งค่า JWT_SECRET ใน backend/.env' });
      return;
    }

    res.status(500).json({ message: `ไม่สามารถเข้าสู่ระบบได้ (${pgCode || errMsg || 'unknown error'})` });
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
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้' });
  }
}

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

// เปลี่ยนรหัสผ่านใหม่โดยตรวจสอบรหัสผ่านเดิมก่อนอัปเดต
export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const currentPassword = readString(req.body?.currentPassword);
  const newPassword = readString(req.body?.newPassword);

  if (!currentPassword || newPassword.length < 6) {
    res.status(400).json({ message: 'กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร' });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' });
    return;
  }

  try {
    const result = await pool.query<{ id: number; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      res.status(401).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    res.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
  }
}

// อัปเดตข้อมูลติดต่อ (อีเมลและเบอร์โทร) ของผู้ใช้ที่ล็อกอินอยู่
export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const email = readString(req.body?.email);
  const phone = readString(req.body?.phone);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    return;
  }

  try {
    const updated = await pool.query<UserRow>(
      `UPDATE users
       SET email = $1, phone = $2
       WHERE id = $3
       RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
      [email || null, phone || null, req.user.id]
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

// สร้างโทเคนรีเซ็ตรหัสผ่าน (อายุ 15 นาที) และส่งลิงก์ทางอีเมลให้ผู้ใช้
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const email = readString(req.body?.email).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'กรุณากรอกอีเมลให้ถูกต้อง' });
    return;
  }

  try {
    const found = await pool.query<{ id: number; name: string; email: string }>(
      'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );
    const user = found.rows[0];

    if (!user) {
      // ป้องกัน User Enumeration ใน production แต่ให้ข้อความชัดเจน
      res.json({
        emailSent: false,
        message:
          'หากอีเมลนี้ลงทะเบียนในระบบแล้ว ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้ทางอีเมล (กรุณาตรวจสอบว่ากรอกอีเมลเดียวกับตอนสมัคร)',
      });
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await pool.query(
      `UPDATE users
       SET reset_token_hash = $1,
           reset_token_expires = NOW() + INTERVAL '15 minutes'
       WHERE id = $2`,
      [tokenHash, user.id]
    );

    const resetUrl = buildFrontendRedirectUrl('/reset-password', { token: rawToken });

    let mailSent = false;
    let mailError = '';

    try {
      const result = await sendMail({
        to: user.email,
        subject: 'รีเซ็ตรหัสผ่านระบบยืม-คืนอุปกรณ์กีฬา UTCC Sport',
        text: `สวัสดีคุณ ${user.name}\n\nคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์มีอายุ 15 นาที):\n${resetUrl}\n\nหากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยอีเมลนี้`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px">
            <h2 style="color:#064e3b;margin:0 0 12px">รีเซ็ตรหัสผ่าน UTCC Sport</h2>
            <p style="color:#374151;font-size:14px">สวัสดีคุณ <strong>${user.name}</strong>,</p>
            <p style="color:#374151;font-size:14px">กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์มีอายุ 15 นาที):</p>
            <p style="margin:24px 0">
              <a href="${resetUrl}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">
                ตั้งรหัสผ่านใหม่
              </a>
            </p>
            <p style="color:#6b7280;font-size:12px">หรือคัดลอกลิงก์: ${resetUrl}</p>
          </div>
        `,
      });
      mailSent = result.sent;
      if (!result.sent && result.reason) {
        mailError = result.reason;
      }
    } catch (err) {
      mailError = err instanceof Error ? err.message : 'SMTP error';
      console.error('Failed to send reset email:', err);
    }

    if (!mailSent) {
      res.status(503).json({
        message:
          mailError === 'SMTP is not configured'
            ? 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าผู้ส่งอีเมล (SMTP_USER / SMTP_PASS) ใน backend/.env จึงยังไม่สามารถส่งอีเมลได้'
            : `ส่งอีเมลไม่สำเร็จ (${mailError || 'SMTP error'})`,
      });
      return;
    }

    res.json({
      emailSent: true,
      message: `ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล ${user.email} เรียบร้อยแล้ว กรุณาตรวจสอบกล่องขาเข้าหรือ Junk Mail`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถดำเนินการขอรีเซ็ตรหัสผ่านได้' });
  }
}

// ตรวจสอบโทเคนรีเซ็ตจากอีเมลและบันทึกรหัสผ่านใหม่ลงฐานข้อมูล
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

// ตรวจสอบตัวตนผู้ใช้ด้วยอีเมลและรหัสนักศึกษา เพื่อรีเซ็ตรหัสผ่านได้ทันทีโดยไม่ต้องพึ่งอีเมล
export async function verifyResetIdentity(req: Request, res: Response): Promise<void> {
  const email = readString(req.body?.email).toLowerCase();
  const studentId = readString(req.body?.studentId);

  if (!email || !studentId) {
    res.status(400).json({ message: 'กรุณากรอกทั้งอีเมลและรหัสนักศึกษา/ชื่อผู้ใช้' });
    return;
  }

  try {
    const found = await pool.query<{ id: number; name: string; student_id: string; email: string }>(
      `SELECT id, name, student_id, email FROM users
       WHERE LOWER(email) = LOWER($1) AND (student_id = $2 OR LOWER(email) = LOWER($2))
       LIMIT 1`,
      [email, studentId]
    );

    const user = found.rows[0];
    if (!user) {
      res.status(404).json({
        message: 'ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบอีเมลและรหัสนักศึกษาให้ถูกต้อง',
      });
      return;
    }

    // สร้าง reset token ชั่วคราว (15 นาที) สำหรับเปลี่ยนรหัสผ่าน
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
      message: `ยืนยันตัวตนสำเร็จ (${user.name}) กรุณาตั้งรหัสผ่านใหม่`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' });
  }
}

// บันทึกรหัสผ่านใหม่ทันทีหลังจากยืนยันตัวตนสำเร็จ
export async function instantResetPassword(req: Request, res: Response): Promise<void> {
  const token = readString(req.body?.token);
  const email = readString(req.body?.email).toLowerCase();
  const studentId = readString(req.body?.studentId);
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

    if (!userId && email && studentId) {
      const found = await pool.query<{ id: number }>(
        `SELECT id FROM users
         WHERE LOWER(email) = LOWER($1) AND (student_id = $2 OR LOWER(email) = LOWER($2))
         LIMIT 1`,
        [email, studentId]
      );
      if (found.rows[0]) {
        userId = found.rows[0].id;
      }
    }

    if (!userId) {
      res.status(400).json({
        message: 'การยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง',
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
    res.status(500).json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่' });
  }
}

// Helper สำหรับค้นหาหรือสร้างผู้ใช้จาก Social Login (Microsoft / Google)
async function findOrCreateOAuthUser(data: {
  email: string;
  name: string;
  authProvider: 'microsoft' | 'google';
  fallbackStudentId?: string;
}): Promise<UserRow> {
  const email = data.email.trim().toLowerCase();
  const existing = await pool.query<UserRow>(
    `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );

  if (existing.rows[0]) {
    let user = existing.rows[0];
    if (user.auth_provider !== data.authProvider) {
      await pool.query('UPDATE users SET auth_provider = $1 WHERE id = $2', [data.authProvider, user.id]);
      user = { ...user, auth_provider: data.authProvider };
    }
    return user;
  }

  const localPart = email.split('@')[0] || '';
  const candidateStudentId = data.fallbackStudentId
    ? data.fallbackStudentId
    : /^\d{13}$/.test(localPart)
    ? localPart
    : `${data.authProvider.slice(0, 2)}-${createHash('sha256').update(email).digest('hex').slice(0, 10)}`;

  const randomHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
  const displayName = data.name.trim() || localPart;

  const inserted = await pool.query<UserRow>(
    `INSERT INTO users (student_id, name, email, password_hash, role, auth_provider)
     VALUES ($1, $2, $3, $4, 'student', $5)
     ON CONFLICT (student_id) DO UPDATE 
     SET email = EXCLUDED.email, auth_provider = EXCLUDED.auth_provider
     RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
    [candidateStudentId, displayName, email, randomHash, data.authProvider]
  );

  const newUser = inserted.rows[0];
  if (!newUser) {
    throw new Error('ไม่สามารถสร้างผู้ใช้จาก Social Login ได้');
  }
  return newUser;
}

// อ่านค่าตั้งค่า Microsoft Entra ID (OAuth 2.0) จากตัวแปรแวดล้อม
function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() || '';
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || 'common';
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI?.trim() ||
    `http://localhost:${Number(process.env.PORT) || 5000}/api/auth/microsoft/callback`;

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
  };
}

// ส่งสถานะว่าเซิร์ฟเวอร์ตั้งค่าการล็อกอินผ่าน Microsoft พร้อมใช้งานหรือไม่
export function microsoftStatus(_req: Request, res: Response): void {
  const cfg = getMicrosoftConfig();
  res.json({
    configured: cfg.configured,
    tenantId: cfg.tenantId,
    redirectUri: cfg.redirectUri,
    demoAvailable: true,
  });
}

// พาผู้ใช้ Redirect ไปยังหน้าล็อกอินของ Microsoft หรือเข้าสู่โหมดจำลอง (Demo Login)
export async function microsoftAuth(req: Request, res: Response): Promise<void> {
  const cfg = getMicrosoftConfig();
  const returnOrigin = readString(req.query.redirect) || readString(req.query.origin);

  // หากยังไม่ได้ตั้งค่า Client ID / Secret ใน .env ให้เข้าสู่โหมดจำลอง (Demo Login) ทันที
  if (!cfg.configured) {
    try {
      const demoUser = await findOrCreateOAuthUser({
        email: 'student.ms@live.utcc.ac.th',
        name: 'Microsoft Student (Demo)',
        authProvider: 'microsoft',
        fallbackStudentId: '2410511101055',
      });
      const appJwt = signToken(demoUser);
      sendSafeRedirect(res, buildFrontendRedirectUrl('/auth/microsoft/callback', { token: appJwt, isDemo: 'true' }, returnOrigin));
      return;
    } catch (err) {
      console.error('Demo Microsoft login error:', err);
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'demo_failed' }, returnOrigin));
      return;
    }
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'JWT_SECRET is not set' });
    return;
  }

  const state = jwt.sign({ purpose: 'microsoft_oauth', returnOrigin }, secret, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
    prompt: 'select_account',
  });

  res.redirect(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${params.toString()}`);
}

// รับ Callback จาก Microsoft, แลก Token ดึงข้อมูลผู้ใช้ แล้วสร้าง/เข้าสู่ระบบพร้อมส่ง JWT กลับ Frontend
export async function microsoftCallback(req: Request, res: Response): Promise<void> {
  const cfg = getMicrosoftConfig();

  const code = readString(req.query.code);
  const state = readString(req.query.state);
  const oauthError = readString(req.query.error);

  if (oauthError) {
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: oauthError }));
    return;
  }

  if (!cfg.configured || !code || !state) {
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'invalid_callback' }));
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'server_config' }));
    return;
  }

  let returnOrigin: string | undefined;
  try {
    const decodedState = jwt.verify(state, secret) as { purpose?: string; returnOrigin?: string };
    if (decodedState.purpose !== 'microsoft_oauth') {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'invalid_state' }));
      return;
    }
    returnOrigin = decodedState.returnOrigin;

    const tokenResp = await fetch(
      `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    const tokenJson = (await tokenResp.json()) as { access_token?: string; error_description?: string };
    if (!tokenResp.ok || !tokenJson.access_token) {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'token_exchange_failed' }, returnOrigin));
      return;
    }

    const graphResp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = (await graphResp.json()) as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
      id?: string;
    };

    const email = (profile.mail || profile.userPrincipalName || '').trim().toLowerCase();
    if (!email || !isAllowedEmail(email)) {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'invalid_email' }, returnOrigin));
      return;
    }

    const user = await findOrCreateOAuthUser({
      email,
      name: profile.displayName || email.split('@')[0],
      authProvider: 'microsoft',
    });

    const appJwt = signToken(user);
    sendSafeRedirect(res, buildFrontendRedirectUrl('/auth/microsoft/callback', { token: appJwt }, returnOrigin));
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'oauth_failed' }, returnOrigin));
  }
}

// อ่านค่าตั้งค่า Google OAuth 2.0 จากตัวแปรแวดล้อม
function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `http://localhost:${Number(process.env.PORT) || 5000}/api/auth/google/callback`;

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

// ส่งสถานะว่าเซิร์ฟเวอร์ตั้งค่าการล็อกอินผ่าน Google พร้อมใช้งานหรือไม่
export function googleStatus(_req: Request, res: Response): void {
  const cfg = getGoogleConfig();
  res.json({
    configured: cfg.configured,
    redirectUri: cfg.redirectUri,
    demoAvailable: true,
  });
}

// พาผู้ใช้ Redirect ไปยังหน้าล็อกอิน Google หรือเข้าสู่โหมดจำลอง (Demo Login)
export async function googleAuth(req: Request, res: Response): Promise<void> {
  const cfg = getGoogleConfig();
  const returnOrigin = readString(req.query.redirect) || readString(req.query.origin);

  // หากยังไม่ได้ตั้งค่า Google OAuth ใน .env ให้เข้าสู่โหมดจำลอง (Demo Login) ทันที
  if (!cfg.configured) {
    try {
      const demoUser = await findOrCreateOAuthUser({
        email: 'demo.student@gmail.com',
        name: 'Google Student (Demo)',
        authProvider: 'google',
        fallbackStudentId: 'google-demo-user',
      });
      const appJwt = signToken(demoUser);
      sendSafeRedirect(res, buildFrontendRedirectUrl('/auth/google/callback', { token: appJwt, isDemo: 'true' }, returnOrigin));
      return;
    } catch (err) {
      console.error('Demo Google login error:', err);
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'demo_failed' }, returnOrigin));
      return;
    }
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'JWT_SECRET is not set' });
    return;
  }

  const state = jwt.sign({ purpose: 'google_oauth', returnOrigin }, secret, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

// รับ Callback จาก Google, แลก Token ดึงข้อมูลผู้ใช้ แล้วสร้าง/เข้าสู่ระบบพร้อมส่ง JWT กลับ Frontend
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const cfg = getGoogleConfig();

  const code = readString(req.query.code);
  const state = readString(req.query.state);
  const oauthError = readString(req.query.error);

  if (oauthError) {
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: oauthError }));
    return;
  }

  if (!cfg.configured || !code || !state) {
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'invalid_callback' }));
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'server_config' }));
    return;
  }

  let returnOrigin: string | undefined;
  try {
    const decodedState = jwt.verify(state, secret) as { purpose?: string; returnOrigin?: string };
    if (decodedState.purpose !== 'google_oauth') {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'invalid_state' }));
      return;
    }
    returnOrigin = decodedState.returnOrigin;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = (await tokenResp.json()) as { access_token?: string; error_description?: string };
    if (!tokenResp.ok || !tokenJson.access_token) {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'token_exchange_failed' }, returnOrigin));
      return;
    }

    const userinfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = (await userinfoResp.json()) as {
      email?: string;
      name?: string;
      id?: string;
    };

    const email = (profile.email || '').trim().toLowerCase();
    if (!email || !isAllowedEmail(email)) {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'invalid_email' }, returnOrigin));
      return;
    }

    const user = await findOrCreateOAuthUser({
      email,
      name: profile.name || email.split('@')[0],
      authProvider: 'google',
    });

    const appJwt = signToken(user);
    sendSafeRedirect(res, buildFrontendRedirectUrl('/auth/google/callback', { token: appJwt }, returnOrigin));
  } catch (error) {
    console.error('Google OAuth error:', error);
    sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'oauth_failed' }, returnOrigin));
  }
}
