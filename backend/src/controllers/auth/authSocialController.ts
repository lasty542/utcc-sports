/**
 * โมดูลจัดการการเข้าสู่ระบบผ่าน Social Login (Google OAuth)
 */
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { readString } from '../../utils';
import {
  buildFrontendRedirectUrl,
  findOrCreateSocialUser,
  isAllowedEmail,
  sendSafeRedirect,
  signToken,
} from './authHelpers';

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const port = Number(process.env.PORT) || 5000;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `http://localhost:${port}/api/auth/google/callback`;

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

// ตรวจสอบสถานะการเชื่อมต่อ Google OAuth
export function googleStatus(_req: Request, res: Response): void {
  const cfg = getGoogleConfig();
  res.json({
    configured: cfg.configured,
    redirectUri: cfg.redirectUri,
    demoAvailable: true,
  });
}

// นำผู้ใช้ไปยังหน้าล็อกอิน Google หรือเข้าสู่โหมด Demo
export async function googleAuth(req: Request, res: Response): Promise<void> {
  const cfg = getGoogleConfig();
  const returnOrigin = readString(req.query.redirect) || readString(req.query.origin);

  if (!cfg.configured) {
    try {
      const demoUser = await findOrCreateSocialUser({
        email: 'demo.student@gmail.com',
        name: 'Google Student (Demo)',
        authProvider: 'google',
      });
      const appJwt = signToken(demoUser);
      sendSafeRedirect(
        res,
        buildFrontendRedirectUrl('/auth/google/callback', { token: appJwt, isDemo: 'true' }, returnOrigin)
      );
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

// Callback จาก Google แลก token และสร้าง session
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

    const tokenJson = (await tokenResp.json()) as { access_token?: string };
    if (!tokenResp.ok || !tokenJson.access_token) {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'token_exchange_failed' }, returnOrigin));
      return;
    }

    const userinfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = (await userinfoResp.json()) as { email?: string; name?: string };

    const email = (profile.email || '').trim().toLowerCase();
    if (!email || !isAllowedEmail(email)) {
      sendSafeRedirect(res, buildFrontendRedirectUrl('/', { googleError: 'invalid_email' }, returnOrigin));
      return;
    }

    const user = await findOrCreateSocialUser({
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

// Stubs สำหรับ Microsoft OAuth ที่ไม่ได้ใช้งาน (รักษา Route URL เดิมไม่ให้ 404)
export function microsoftStatus(_req: Request, res: Response): void {
  res.json({ configured: false, message: 'Microsoft OAuth is disabled' });
}

export function microsoftAuth(req: Request, res: Response): void {
  const returnOrigin = readString(req.query.redirect) || readString(req.query.origin);
  sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'disabled' }, returnOrigin));
}

export function microsoftCallback(_req: Request, res: Response): void {
  sendSafeRedirect(res, buildFrontendRedirectUrl('/', { msError: 'disabled' }));
}
