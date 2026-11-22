/**
 * ฟอร์มสมัครสมาชิกใหม่ (Register Form)
 */
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterFormProps {
  onGoogleSignIn: () => void;
  isSocialLoading: boolean;
  onSuccess: () => void;
}

export default function RegisterForm({
  onGoogleSignIn,
  isSocialLoading,
  onSuccess,
}: RegisterFormProps) {
  const { login: setAuthSession } = useAuth();

  const [studentId, setStudentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyDomainSuffix = (domain: string) => {
    const raw = email.trim();
    const usernamePart = raw.includes('@') ? raw.split('@')[0] : raw;
    setEmail(usernamePart ? `${usernamePart}@${domain}` : `@${domain}`);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanStudentId = studentId.trim();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanStudentId) {
      setError('กรุณากรอกรหัสนักศึกษา');
      return;
    }
    if (!cleanFirst || !cleanLast) {
      setError('กรุณากรอกชื่อและนามสกุล');
      return;
    }
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authService.register({
        studentId: cleanStudentId,
        name: `${cleanFirst} ${cleanLast}`,
        email: cleanEmail,
        password,
      });
      setAuthSession(res.user, res.token);
      onSuccess();
    } catch (err: unknown) {
      const errRes =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(errRes || 'เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      key="minimal-register"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16 }}
    >
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-2xl mb-3 shadow-2xs">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2 text-xs" noValidate>
        <div>
          <label className="block font-bold text-slate-800 mb-0.5" htmlFor="regStudentId">
            รหัสนักศึกษา
          </label>
          <input
            id="regStudentId"
            type="text"
            maxLength={16}
            placeholder="เช่น 2410511101055"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-0.5" htmlFor="regFirstName">
            ชื่อจริง
          </label>
          <input
            id="regFirstName"
            type="text"
            placeholder="กรอกชื่อจริงของคุณ"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-0.5" htmlFor="regLastName">
            นามสกุล
          </label>
          <input
            id="regLastName"
            type="text"
            placeholder="กรอกนามสกุลของคุณ"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="font-bold text-slate-800" htmlFor="regEmail">
              อีเมลติดต่อ
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => applyDomainSuffix('gmail.com')}
                className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full cursor-pointer transition-colors border border-slate-200"
              >
                @gmail.com
              </button>
              <button
                type="button"
                onClick={() => applyDomainSuffix('live4.utcc.ac.th')}
                className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full cursor-pointer transition-colors border border-emerald-200"
              >
                @live4.utcc.ac.th
              </button>
            </div>
          </div>
          <input
            id="regEmail"
            type="email"
            placeholder="yourname@gmail.com หรือ @live4.utcc.ac.th"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-0.5" htmlFor="regPassword">
            รหัสผ่าน (6+ ตัวอักษร)
          </label>
          <div className="relative">
            <input
              id="regPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-0.5" htmlFor="regConfirm">
            ยืนยันรหัสผ่าน
          </label>
          <div className="relative">
            <input
              id="regConfirm"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="กรอกรหัสผ่านเดิมอีกครั้ง"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm mt-1.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> กำลังสร้างบัญชี...
            </>
          ) : (
            <>
              สมัครสมาชิกและเข้าใช้งาน <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-[10px]">
          <span className="bg-white px-2.5 text-slate-500 font-semibold">
            หรือสมัครด้วย Google
          </span>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isSubmitting || isSocialLoading}
          className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold py-3 px-4 rounded-2xl border border-slate-300 shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer"
        >
          {isSocialLoading ? (
            <Loader2 size={17} className="animate-spin text-slate-500" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>สมัครสมาชิกด้วย Google</span>
        </button>
      </div>
    </motion.div>
  );
}
