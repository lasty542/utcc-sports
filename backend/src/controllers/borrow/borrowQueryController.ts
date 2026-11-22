/**
 * โมดูลเรียกดูข้อมูลคำขอยืม-คืน, ตรวจสอบโควตา และสร้าง Dynamic QR Pass
 */
import type { Request, Response } from 'express';
import { pool } from '../../config/db';
import {
  BORROW_SELECT,
  type BorrowRow,
  derive6DigitPin,
  signQrPayload,
  toBorrow,
} from './borrowHelpers';

// ตรวจสอบโควตาการยืม (สูงสุด 3 ชิ้น ไม่เกิน 2 คำขอพร้อมกัน)
export async function getUserQuota(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  try {
    const summary = await pool.query<{
      current_items: number;
      current_requests: number;
      has_overdue: boolean;
    }>(
      `SELECT
         COALESCE(SUM(quantity), 0)::int AS current_items,
         COUNT(*)::int AS current_requests,
         COALESCE(BOOL_OR(COALESCE(due_date, return_date, CURRENT_DATE) < CURRENT_DATE), false) AS has_overdue
       FROM borrows
       WHERE user_id = $1 AND status IN ('pending', 'approved', 'borrowing', 'borrowed')`,
      [req.user.id]
    );

    const row = summary.rows[0] || { current_items: 0, current_requests: 0, has_overdue: false };
    const maxItems = 3;
    const maxRequests = 3;
    const currentItems = Number(row.current_items) || 0;
    const currentRequests = Number(row.current_requests) || 0;
    const hasOverdue = Boolean(row.has_overdue);

    res.json({
      maxItems,
      maxRequests,
      currentItems,
      currentRequests,
      remainingItems: Math.max(0, maxItems - currentItems),
      remainingRequests: Math.max(0, maxRequests - currentRequests),
      hasOverdue,
      canBorrow: !hasOverdue && currentItems < maxItems && currentRequests < maxRequests,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in getUserQuota:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลโควตาได้', error: msg });
  }
}

// ดึงรายการยืม-คืนทั้งหมด (Admin ดูได้ทั้งหมด, นักศึกษาดูเฉพาะของตนเอง)
export async function listBorrows(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  try {
    const result =
      req.user.role === 'admin'
        ? await pool.query<BorrowRow>(`${BORROW_SELECT} ORDER BY b.id DESC`)
        : await pool.query<BorrowRow>(
            `${BORROW_SELECT} WHERE b.user_id = $1 ORDER BY b.id DESC`,
            [req.user.id]
          );

    res.json({ borrows: result.rows.map(toBorrow) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in listBorrows:', error);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายการยืมได้', error: msg });
  }
}

// สร้าง Dynamic QR Token และ PIN 6 หลักที่หมุนเวียนทุก 30 วินาที
export async function getQrToken(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'ไม่พบโทเคนสำหรับยืนยันตัวตน' });
    return;
  }

  const requestedBorrowId = Number(req.query.borrowId);

  try {
    let targetBorrow: BorrowRow | undefined;

    if (Number.isInteger(requestedBorrowId) && requestedBorrowId > 0) {
      const specific = await pool.query<BorrowRow>(
        `${BORROW_SELECT}
         WHERE b.id = $1 AND b.user_id = $2 AND b.status IN ('pending', 'approved', 'borrowing', 'borrowed')`,
        [requestedBorrowId, req.user.id]
      );
      targetBorrow = specific.rows[0];
    }

    if (!targetBorrow) {
      const latestActive = await pool.query<BorrowRow>(
        `${BORROW_SELECT}
         WHERE b.user_id = $1 AND b.status IN ('pending', 'approved', 'borrowing', 'borrowed')
         ORDER BY b.id DESC
         LIMIT 1`,
        [req.user.id]
      );
      targetBorrow = latestActive.rows[0];
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const step = Math.floor(nowSec / 30);
    const secondsRemaining = 30 - (nowSec % 30);

    if (targetBorrow) {
      const sig = signQrPayload(String(req.user.id), targetBorrow.id, step);
      res.json({
        qrToken: `UTCC-PASS:${targetBorrow.id}:${step}:${sig}`,
        pin: derive6DigitPin(sig),
        step,
        secondsRemaining,
        borrow: toBorrow(targetBorrow),
      });
      return;
    }

    const sig = signQrPayload(req.user.studentId, 0, step);
    res.json({
      qrToken: `UTCC-ID:${req.user.studentId}:${step}:${sig}`,
      pin: derive6DigitPin(sig),
      step,
      secondsRemaining,
      borrow: null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in getQrToken:', error);
    res.status(500).json({ message: 'ไม่สามารถสร้างรหัส QR ได้', error: msg });
  }
}
