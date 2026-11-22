/**
 * หน้าตั้งรหัสผ่านใหม่จากลิงก์ที่ได้รับทางอีเมล
 */
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Leaf } from 'lucide-react';
import { authService } from '../../services/authService';

const SCENIC_MEADOW_BG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop';

// หน้าฟอร์มสำหรับตั้งรหัสผ่านใหม่โดยใช้ Token จาก Query String
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ตรวจสอบความถูกต้องของรหัสผ่านใหม่และส่งคำขออัปเดตไปยัง Backend
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('ไม่พบโทเคนรีเซ็ตรหัสผ่านในลิงก์นี้');
      return;
    }
    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authService.resetPassword(token, newPassword);
      setSuccessMessage(res.message);
    } catch (err) {
      setError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้'
          : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#89a9ba] bg-cover bg-center flex items-center justify-center p-4 font-sans relative"
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      <div className="fixed inset-0 bg-gradient-to-b from-sky-900/15 via-emerald-950/15 to-emerald-950/40 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white/75 backdrop-blur-3xl backdrop-saturate-150 rounded-[2.4rem] p-7 sm:p-8 shadow-[0_28px_70px_rgba(15,23,42,0.28)] border border-white/80"
      >
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800 mb-5">
          <Leaf size={16} className="text-emerald-600" /> UTCC Sports Security
        </div>

        {successMessage ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-xl font-black text-slate-900 mb-2">ตั้งรหัสผ่านใหม่สำเร็จ!</h1>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">{successMessage}</p>
            <Link
              to="/"
              className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-2xl text-xs inline-flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <ArrowLeft size={15} /> ไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-emerald-100 text-emerald-800 p-3 rounded-2xl">
                <KeyRound size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">ตั้งรหัสผ่านใหม่</h1>
                <p className="text-xs text-slate-600">กรอกรหัสผ่านใหม่สำหรับบัญชี UTCC Sport ของคุณ</p>
              </div>
            </div>

            {!token && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3.5 py-2.5 rounded-2xl mb-4">
                ลิงก์รีเซ็ตรหัสผ่านไม่สมบูรณ์ กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3.5 py-2.5 rounded-2xl mb-4 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
              <div>
                <label className="block font-bold text-slate-800 mb-1.5" htmlFor="newPassword">
                  รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting || !token}
                    placeholder="กรอกรหัสผ่านใหม่"
                    className="w-full bg-white/80 border border-white rounded-2xl px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5" htmlFor="confirmPassword">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting || !token}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="w-full bg-white/80 border border-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-xs cursor-pointer shadow-lg inline-flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                บันทึกรหัสผ่านใหม่
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link
                to="/"
                className="text-xs font-bold text-emerald-900 hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft size={13} /> กลับหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
