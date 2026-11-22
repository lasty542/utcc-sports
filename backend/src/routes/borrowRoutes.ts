/**
 * กำหนดเส้นทาง API สำหรับการยืม-คืนอุปกรณ์, สร้าง/ตรวจสอบ Dynamic QR Pass และยืนยันรับอุปกรณ์
 */
import { Router } from 'express';
import {
  confirmPickup,
  createBorrow,
  deleteBorrow,
  getQrToken,
  listBorrows,
  returnBorrow,
  verifyScan,
} from '../controllers/borrowController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);
router.get('/', listBorrows);
router.get('/qr-token', getQrToken);
router.post('/', createBorrow);
router.post('/:id/pickup', confirmPickup);
router.post('/verify-scan', requireRole('admin'), verifyScan);
router.patch('/:id/return', returnBorrow);
router.delete('/:id', requireRole('admin'), deleteBorrow);

export default router;
