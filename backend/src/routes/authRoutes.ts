/**
 * กำหนดเส้นทาง API สำหรับการยืนยันตัวตน (สมัครสมาชิก, เข้าสู่ระบบ, รีเซ็ตรหัสผ่าน, Microsoft OAuth และจัดการบัญชี)
 */
import { Router } from 'express';
import {
  changePassword,
  disableOtp,
  forgotPassword,
  googleAuth,
  googleCallback,
  googleStatus,
  login,
  me,
  microsoftAuth,
  microsoftCallback,
  microsoftStatus,
  register,
  resetPassword,
  setupOtp,
  updateProfile,
  verifyOtp,
  verifyResetIdentity,
  instantResetPassword,
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-reset-identity', verifyResetIdentity);
router.post('/instant-reset-password', instantResetPassword);
router.get('/microsoft/status', microsoftStatus);
router.get('/microsoft', microsoftAuth);
router.get('/microsoft/callback', microsoftCallback);
router.get('/google/status', googleStatus);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/me', authMiddleware, me);
router.patch('/profile', authMiddleware, updateProfile);
router.post('/change-password', authMiddleware, changePassword);
router.post('/otp/setup', authMiddleware, setupOtp);
router.post('/otp/verify', authMiddleware, verifyOtp);
router.post('/otp/disable', authMiddleware, disableOtp);

export default router;
