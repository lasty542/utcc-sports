/**
 * โมดูลฟังก์ชันช่วยเหลือร่วมสำหรับระบบ Authentication
 */
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/db';
import type { AuthPayload } from '../../middlewares/authMiddleware';

export interface UserRow {
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

export function toPublicUser(user: UserRow) {
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

export function getAllAllowedEmailDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS || '*';
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  const allowed = getAllAllowedEmailDomains();
  if (allowed.length === 0 || allowed.includes('*')) return true;
  const domain = normalized.split('@')[1] || '';
  return allowed.some((a: string) => domain === a || domain.endsWith(`.${a}`));
}

export function isUniversityEmail(email: string): boolean {
  return isAllowedEmail(email);
}

export function getFrontendUrl(customBase?: string): string {
  let raw = (customBase || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  raw = raw.replace(/^["']|["']$/g, '').trim();
  raw = raw.replace(/[\r\n\t]/g, '').trim();
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/+$/, '');
}

export function buildFrontendRedirectUrl(
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

export function sendSafeRedirect(res: Response, targetUrl: string): void {
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

export function signToken(user: UserRow): string {
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

export async function verifyAndUpgradePassword(
  password: string,
  storedHash: string | null | undefined,
  userId: number
): Promise<boolean> {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const cleanHash = storedHash.trim();
  const cleanPass = password.trim();

  // 1. ตรวจสอบ plain text (กรณี dev/admin seed)
  if (cleanHash === password || cleanHash === cleanPass) {
    try {
      const newHash = await import('bcryptjs').then((b) => b.default.hash(cleanPass, 10));
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    } catch {
      // ignore
    }
    return true;
  }

  // 2. Bcrypt compare
  try {
    const bcrypt = await import('bcryptjs').then((b) => b.default);
    return (
      (await bcrypt.compare(password, cleanHash)) ||
      (cleanPass !== password && (await bcrypt.compare(cleanPass, cleanHash)))
    );
  } catch {
    return false;
  }
}

export async function findOrCreateSocialUser(params: {
  email: string;
  name: string;
  authProvider: 'google';
}): Promise<UserRow> {
  const { email, name, authProvider } = params;
  const normalizedEmail = email.trim().toLowerCase();

  const existingRes = await pool.query<UserRow>(
    `SELECT id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled
     FROM users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [normalizedEmail]
  );

  if (existingRes.rows[0]) {
    const user = existingRes.rows[0];
    if (user.auth_provider !== authProvider) {
      await pool.query(
        `UPDATE users
         SET auth_provider = $1, name = COALESCE(NULLIF(name, ''), $2)
         WHERE id = $3`,
        [authProvider, name, user.id]
      );
      user.auth_provider = authProvider;
    }
    return user;
  }

  const emailUserPart = normalizedEmail.split('@')[0] || 'social';
  let candidateStudentId = emailUserPart.slice(0, 32);
  const checkSid = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE student_id = $1 LIMIT 1`,
    [candidateStudentId]
  );
  if (checkSid.rows[0]) {
    candidateStudentId = `${candidateStudentId.slice(0, 26)}_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const dummyHash = `oauth_${authProvider}_nopass_${Date.now()}`;
  const insertRes = await pool.query<UserRow>(
    `INSERT INTO users (student_id, name, email, password_hash, role, auth_provider)
     VALUES ($1, $2, $3, $4, 'student', $5)
     RETURNING id, student_id, name, email, phone, password_hash, role, auth_provider, otp_secret, otp_enabled`,
    [candidateStudentId, name, normalizedEmail, dummyHash, authProvider]
  );

  return insertRes.rows[0];
}
