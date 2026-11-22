/**
 * หน้าต่าง Modal สำหรับรีเซ็ตรหัสผ่านทันที (2-Step Instant Password Reset)
 */
import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound,
  X,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import axios from 'axios';
import { authService } from '../../../services/authService';
import InstantForgotSuccess from './InstantForgotSuccess';
import VerifyIdentityStep1 from './VerifyIdentityStep1';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InstantForgotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdentifier?: string;
  onResetSuccess: (identifier: string) => void;
}

export default function InstantForgotModal({
  isOpen,
  onClose,
  initialIdentifier = '',
  onResetSuccess,
}: InstantForgotModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState(() => (initialIdentifier.includes('@') ? initialIdentifier.trim() : ''));
  const [studentId, setStudentId] = useState(() => (!initialIdentifier.includes('@') ? initialIdentifier.trim() : ''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  // Step 1: ตรวจสอบข้อมูลผู้ใช้
  const handleVerifyIdentity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedId = studentId.trim();

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (!trimmedId) {
      setError('กรุณากรอกรหัสนักศึกษา หรือชื่อบัญชี');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authService.verifyResetIdentity(trimmedEmail, trimmedId);
      setToken(res.token);
      setUserName(res.name || 'ผู้ใช้งาน');
      setStep(2);
    } catch (err) {
      setError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่พบข้อมูลที่ตรงกันในระบบ กรุณาตรวจสอบอีเมลและรหัสนักศึกษา'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: ตั้งรหัสผ่านใหม่
  const handleResetPasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await authService.instantResetPassword({
        token,
        email: email.trim().toLowerCase(),
        studentId: studentId.trim(),
        newPassword,
      });
      setStep(3);
    } catch (err) {
      setError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-2xl relative border border-slate-200"
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 cursor-pointer p-1 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>

            {/* Header Modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {step === 1
                    ? 'ลืมรหัสผ่าน (ขั้นตอนที่ 1/2)'
                    : step === 2
                    ? 'ตั้งรหัสผ่านใหม่ (ขั้นตอนที่ 2/2)'
                    : 'เปลี่ยนรหัสผ่านสำเร็จ'}
                </h3>
                <p className="text-xs text-slate-500">
                  {step === 1
                    ? 'ยืนยันตัวตนด้วยอีเมลและรหัสนักศึกษา'
                    : step === 2
                    ? `ผู้ใช้งาน: ${userName}`
                    : 'คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที'}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-2.5 rounded-xl border border-red-200 mb-3">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <VerifyIdentityStep1
                email={email}
                setEmail={setEmail}
                studentId={studentId}
                setStudentId={setStudentId}
                isSubmitting={isSubmitting}
                onSubmit={handleVerifyIdentity}
                onClose={handleClose}
              />
            )}

            {step === 2 && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs text-emerald-900 font-medium">
                  ✓ ยืนยันตัวตนสำเร็จ: <strong>{userName}</strong>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    รหัสผ่านใหม่ (6+ ตัวอักษร)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="ตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isSubmitting}
                    className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ArrowLeft size={13} /> ย้อนกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> กำลังบันทึก...
                      </>
                    ) : (
                      'บันทึกรหัสผ่านใหม่'
                    )}
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <InstantForgotSuccess
                identifier={studentId || email}
                onResetSuccess={onResetSuccess}
                onClose={handleClose}
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
