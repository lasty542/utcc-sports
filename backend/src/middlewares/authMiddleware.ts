/**
 * มิดเดิลแวร์ตรวจสอบ JWT Token และสิทธิ์การเข้าถึงตามบทบาท (Role) ของผู้ใช้
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id: number;
  studentId: string;
  role: 'student' | 'admin';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// แปลงและตรวจสอบความถูกต้องของข้อมูลภายใน JWT Payload
function readPayload(decoded: string | jwt.JwtPayload): AuthPayload | null {
  if (typeof decoded === 'string') {
    return null;
  }

  const id = Number(decoded.id);
  const studentId = decoded.studentId;
  const role = decoded.role;
  const name = decoded.name;

  if (!Number.isInteger(id) || typeof studentId !== 'string' || typeof name !== 'string') {
    return null;
  }

  if (role !== 'student' && role !== 'admin') {
    return null;
  }

  return { id, studentId, role, name };
}

// ตรวจสอบ Bearer Token จาก Authorization Header แล้วแนบข้อมูลผู้ใช้ลงใน req.user
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า JWT_SECRET' });
    return;
  }

  try {
    const payload = readPayload(jwt.verify(header.slice('Bearer '.length), secret));
    if (!payload) {
      res.status(401).json({ message: 'โทเคนไม่ถูกต้อง' });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'โทเคนหมดอายุหรือไม่ถูกต้อง' });
  }
}

// สร้างมิดเดิลแวร์จำกัดสิทธิ์เฉพาะบทบาทที่กำหนด (เช่น admin หรือ student)
export function requireRole(...roles: Array<AuthPayload['role']>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรายการนี้' });
      return;
    }

    next();
  };
}
