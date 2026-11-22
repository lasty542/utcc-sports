/**
 * หน้าเข้าสู่ระบบและสมัครสมาชิก UTCC Sport (Minimal Clean Unified Login)
 * ดีไซน์คลีน มินิมอล รองรับการแสดงผลทุกขนาดหน้าจอ ทั้งมือถือ โน้ตบุ๊ก และคอมพิวเตอร์
 */
import { useState, useContext, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  MailCheck,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  Mail,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { AuthContext } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

type AuthMode = 'login' | 'register';

interface FormErrors {
  identifier?: string;
  password?: string;
}

interface LoginErrorResponse {
  message?: string;
}

const SCENIC_MEADOW_BG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// แปลงรหัส Error จาก Social OAuth Callback เป็นข้อความภาษาไทย
function mapOAuthQueryError(code: string | null, provider: 'ms' | 'google'): string | null {
  if (!code) return null;
  if (code === 'demo_failed') {
    return `ไม่สามารถเริ่มการเข้าสู่ระบบแบบจำลอง (${provider === 'ms' ? 'Microsoft' : 'Google'}) ได้`;
  }
  if (code === 'not_configured') {
    return `ยังไม่ได้ตั้งค่า ${provider === 'ms' ? 'Microsoft' : 'Google'} OAuth ใน Backend`;
  }
  if (code === 'oauth_failed') {
    return `การยืนยันตัวตนด้วย ${provider === 'ms' ? 'Microsoft' : 'Google'} ไม่สำเร็จ กรุณาลองใหม่`;
  }
  return `เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย ${provider === 'ms' ? 'Microsoft' : 'Google'}`;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authContext = useContext(AuthContext);

  // สลับโหมด เข้าสู่ระบบ vs สมัครสมาชิก
  const [mode, setMode] = useState<AuthMode>('login');

  // Login Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(() => {
    const msErr = searchParams.get('msError');
    if (msErr) return mapOAuthQueryError(msErr, 'ms');
    const gErr = searchParams.get('googleError');
    if (gErr) return mapOAuthQueryError(gErr, 'google');
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Social Login Loading State
  const [isSocialLoading, setIsSocialLoading] = useState<'google' | 'microsoft' | null>(null);

  // Register State (สำหรับนักศึกษาใหม่)
  const [regStudentId, setRegStudentId] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Forgot Password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState<string | null>(null);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotResult, setForgotResult] = useState<{
    message: string;
    emailSent?: boolean;
  } | null>(null);

  // หากมี session เข้าสู่ระบบอยู่แล้ว ให้นำทางไปยังหน้าที่ถูกต้องตาม Role ทันที
  if (!authContext?.loading && authContext?.user) {
    return <Navigate to={authContext.user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  // ตรวจสอบความถูกต้องของแบบฟอร์มเข้าสู่ระบบ
  const validateLoginForm = (): boolean => {
    const errors: FormErrors = {};
    const trimmedId = identifier.trim();

    if (!trimmedId) {
      errors.identifier = 'กรุณากรอกรหัสนักศึกษา, บัญชีเจ้าหน้าที่ หรืออีเมล';
    } else if (trimmedId.includes('@') && !EMAIL_REGEX.test(trimmedId)) {
      errors.identifier = 'รูปแบบอีเมลไม่ถูกต้อง';
    } else if (trimmedId.length < 2) {
      errors.identifier = 'กรุณากรอกชื่อผู้ใช้หรือรหัสประจำตัว';
    }

    if (!password) {
      errors.password = 'กรุณากรอกรหัสผ่าน';
    } else if (password.length < 4) {
      errors.password = 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // เข้าสู่ระบบฟอร์มเดียวร่วมกัน (Unified Login)
  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setApiError(null);
    if (!validateLoginForm()) return;

    setIsLoading(true);
    try {
      const { token, user } = await authService.login(identifier.trim(), password);
      authContext?.login(user, token);

      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } catch (err) {
      if (axios.isAxiosError<LoginErrorResponse>(err)) {
        setApiError(
          err.response?.data?.message ||
            'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (กรุณาตรวจสอบข้อมูลหรือสมัครสมาชิกก่อน)'
        );
      } else {
        setApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // สมัครสมาชิกใหม่ (สำหรับสิทธิ์ student)
  const handleRegisterSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegError(null);

    const idTrimmed = regStudentId.trim();
    const nameTrimmed = regName.trim();
    const emailTrimmed = regEmail.trim().toLowerCase();

    if (!idTrimmed || idTrimmed.length < 4) {
      setRegError('กรุณากรอกรหัสนักศึกษาให้ถูกต้อง (เช่น 2410511101055)');
      return;
    }
    if (nameTrimmed.length < 2) {
      setRegError('กรุณากรอกชื่อ-นามสกุลจริง');
      return;
    }
    if (!emailTrimmed || !EMAIL_REGEX.test(emailTrimmed)) {
      setRegError('กรุณากรอกอีเมลที่ถูกต้อง (รองรับทั้ง @gmail.com, @hotmail.com, @utcc.ac.th ฯลฯ)');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('ยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsRegistering(true);
    try {
      const { token, user } = await authService.register({
        studentId: idTrimmed,
        name: nameTrimmed,
        email: emailTrimmed,
        password: regPassword,
        role: 'student',
      });
      authContext?.login(user, token);
      navigate('/student', { replace: true });
    } catch (err) {
      setRegError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่สามารถสมัครสมาชิกได้'
          : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  // ดำเนินการเข้าสู่ระบบด้วย Google
  const handleGoogleSignIn = () => {
    setApiError(null);
    setRegError(null);
    setIsSocialLoading('google');
    window.location.href = authService.getGoogleLoginUrl();
  };

  // ดำเนินการเข้าสู่ระบบด้วย Microsoft
  const handleMicrosoftSignIn = () => {
    setApiError(null);
    setRegError(null);
    setIsSocialLoading('microsoft');
    window.location.href = authService.getMicrosoftLoginUrl();
  };

  // เติมโดเมนอีเมลให้อัตโนมัติเมื่อกดชิปแนะนำ
  const applyDomainSuffix = (domain: string) => {
    const base = regEmail.split('@')[0] || regStudentId || 'student';
    setRegEmail(`${base}@${domain}`);
    setRegError(null);
  };

  // เปิด/ปิด Modal รีเซ็ตรหัสผ่าน
  const openForgotModal = () => {
    setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
    setForgotEmailError(null);
    setForgotResult(null);
    setIsForgotModalOpen(true);
  };

  const closeForgotModal = () => {
    if (isForgotSubmitting) return;
    setIsForgotModalOpen(false);
  };

  const handleForgotSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = forgotEmail.trim().toLowerCase();

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setForgotEmailError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    setForgotEmailError(null);
    setIsForgotSubmitting(true);
    try {
      const res = await authService.requestPasswordReset(trimmedEmail);
      setForgotResult(res);
    } catch (err) {
      setForgotEmailError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่สามารถส่งคำขอรีเซ็ตรหัสผ่านได้'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่'
      );
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#89a9ba] bg-cover bg-center bg-fixed font-sans flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-x-hidden"
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      {/* Background Soft Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900/25 via-emerald-950/20 to-slate-950/45 backdrop-blur-[2px] pointer-events-none z-0" />

      {/* Top Floating Mini Brand Pill */}
      <div className="relative z-10 w-full max-w-[460px] mx-auto flex items-center justify-between mb-2 sm:mb-4">
        <div className="inline-flex items-center gap-2 bg-white/85 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/80 shadow-md">
          <Leaf className="text-emerald-600" size={16} />
          <span className="text-xs font-black tracking-wider text-slate-900 uppercase">
            UTCC Sport<span className="text-emerald-600">®</span>
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 bg-white/50 backdrop-blur-xl border border-white/60 text-slate-900 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
          <ShieldCheck size={14} className="text-emerald-700" />
          <span>ระบบยืม-คืนอุปกรณ์กีฬา</span>
        </div>
      </div>

      {/* Main Minimal Centered Card */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[440px] sm:max-w-[460px] mx-auto my-auto bg-white/92 backdrop-blur-2xl rounded-3xl sm:rounded-[2.2rem] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.22)] border border-white/90 p-5 sm:p-7 flex flex-col"
      >
        {/* Brand Icon & Welcome Title */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/20">
            <Leaf size={24} className="stroke-[2.5]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {mode === 'login' ? 'เข้าสู่ระบบ UTCC Sport' : 'สมัครสมาชิกใหม่'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login'
              ? 'ระบบยืม-คืนอุปกรณ์กีฬาออนไลน์ มหาวิทยาลัยหอการค้าไทย'
              : 'กรอกข้อมูลนักศึกษาของคุณเพื่อเริ่มต้นใช้งาน'}
          </p>
        </div>

        {/* Minimal Tab Switcher Pill */}
        <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl mb-5 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setRegError(null);
              setApiError(null);
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LogIn size={15} /> เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setApiError(null);
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus size={15} /> สมัครสมาชิก
          </button>
        </div>

        {/* Global Error Banner */}
        {apiError && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-2xl mb-4"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Animated Form Container */}
        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            /* ==================== LOGIN FORM ==================== */
            <motion.div
              key="minimal-login"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <form onSubmit={handleLogin} className="space-y-3.5" noValidate>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5" htmlFor="identifier">
                    รหัสนักศึกษา / บัญชี หรือ อีเมล
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (fieldErrors.identifier) setFieldErrors((p) => ({ ...p, identifier: undefined }));
                      if (apiError) setApiError(null);
                    }}
                    disabled={isLoading}
                    placeholder="เช่น 2410511101055 หรือ admin"
                    className={`w-full px-4 py-3 rounded-2xl border bg-slate-50/70 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all ${
                      fieldErrors.identifier ? 'border-red-400' : 'border-slate-200/90'
                    }`}
                  />
                  {fieldErrors.identifier && (
                    <p className="text-red-600 text-[11px] font-semibold mt-1">{fieldErrors.identifier}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700" htmlFor="password">
                      รหัสผ่าน
                    </label>
                    <button
                      type="button"
                      onClick={openForgotModal}
                      className="text-xs font-bold text-emerald-700 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                        if (apiError) setApiError(null);
                      }}
                      disabled={isLoading}
                      placeholder="กรอกรหัสผ่านของคุณ"
                      className={`w-full px-4 py-3 pr-11 rounded-2xl border bg-slate-50/70 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all ${
                        fieldErrors.password ? 'border-red-400' : 'border-slate-200/90'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-red-600 text-[11px] font-semibold mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm mt-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> กำลังตรวจสอบ...
                    </>
                  ) : (
                    <>
                      เข้าสู่ระบบ <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>

              {/* Minimal Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-white/95 px-2.5 text-slate-400 font-medium">
                    หรือเข้าสู่ระบบด้วย
                  </span>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isSocialLoading !== null}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-3 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isSocialLoading === 'google' ? (
                    <Loader2 size={16} className="animate-spin text-slate-500" />
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
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleMicrosoftSignIn}
                  disabled={isLoading || isSocialLoading !== null}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-3 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isSocialLoading === 'microsoft' ? (
                    <Loader2 size={16} className="animate-spin text-slate-500" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                  )}
                  <span>Microsoft</span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* ==================== REGISTER FORM ==================== */
            <motion.div
              key="minimal-register"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {regError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-2xl mb-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="regStudentId">
                      รหัสนักศึกษา
                    </label>
                    <input
                      id="regStudentId"
                      type="text"
                      maxLength={16}
                      placeholder="เช่น 2410511101055"
                      value={regStudentId}
                      onChange={(e) => setRegStudentId(e.target.value)}
                      disabled={isRegistering}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="regName">
                      ชื่อ-นามสกุล
                    </label>
                    <input
                      id="regName"
                      type="text"
                      placeholder="ชื่อและนามสกุลจริง"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={isRegistering}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700" htmlFor="regEmail">
                      อีเมลติดต่อ
                    </label>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyDomainSuffix('gmail.com')}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                      >
                        @gmail.com
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDomainSuffix('utcc.ac.th')}
                        className="text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                      >
                        @utcc.ac.th
                      </button>
                    </div>
                  </div>
                  <input
                    id="regEmail"
                    type="email"
                    placeholder="yourname@gmail.com หรือ @utcc.ac.th"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={isRegistering}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="regPassword">
                      รหัสผ่าน (6+ ตัวอักษร)
                    </label>
                    <div className="relative">
                      <input
                        id="regPassword"
                        type={showRegPassword ? 'text' : 'password'}
                        placeholder="••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        disabled={isRegistering}
                        className="w-full px-3.5 py-2.5 pr-8 rounded-2xl border border-slate-200/90 bg-slate-50/70 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((p) => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1" htmlFor="regConfirm">
                      ยืนยันรหัสผ่าน
                    </label>
                    <input
                      id="regConfirm"
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      disabled={isRegistering}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm mt-1"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> กำลังสร้างบัญชี...
                    </>
                  ) : (
                    <>
                      สมัครสมาชิกและเข้าใช้งาน <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>

              {/* Minimal Divider on Register */}
              <div className="relative my-3.5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px]">
                  <span className="bg-white/95 px-2 text-slate-400 font-medium">
                    หรือสมัครด้วย Social Login
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isRegistering || isSocialLoading !== null}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                  Google
                </button>
                <button
                  type="button"
                  onClick={handleMicrosoftSignIn}
                  disabled={isRegistering || isSocialLoading !== null}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Microsoft
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Discreet Test Account Autofill (Collapsible minimal footer for grading/demo) */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <details className="text-[11px] text-slate-400 group cursor-pointer inline-block">
            <summary className="list-none hover:text-slate-600 transition-colors inline-flex items-center gap-1 select-none">
              <span>ℹ️ บัญชีทดสอบระบบ</span>
            </summary>
            <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60 text-left text-xs font-mono space-y-1">
              <button
                type="button"
                onClick={() => {
                  setIdentifier('admin');
                  setPassword('admin1234');
                  setMode('login');
                }}
                className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer transition-all text-left"
                title="คลิกเพื่อกรอกอัตโนมัติ"
              >
                <span>🛡️ Admin: <strong className="text-slate-800">admin</strong></span>
                <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">admin1234</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('2410511101055');
                  setPassword('123456');
                  setMode('login');
                }}
                className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer transition-all text-left"
                title="คลิกเพื่อกรอกอัตโนมัติ"
              >
                <span>🎓 Student: <strong className="text-emerald-700">2410511101055</strong></span>
                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">123456</span>
              </button>
            </div>
          </details>
        </div>
      </motion.div>

      {/* Bottom Minimal Footer */}
      <div className="relative z-10 text-center text-[11px] text-white/80 font-medium mt-3 drop-shadow-xs">
        University of the Thai Chamber of Commerce • UTCC Sport
      </div>

      {/* Frosted Glass Forgot Password Modal */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={closeForgotModal}
          >
            <motion.div
              className="bg-white/95 backdrop-blur-3xl rounded-[2rem] p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-[0_24px_60px_rgba(15,23,42,0.25)] relative border border-white/80"
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeForgotModal}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 cursor-pointer p-1"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">ขอรับลิงก์รีเซ็ตรหัสผ่าน</h3>
                  <p className="text-xs text-slate-500">กรอกอีเมลที่ใช้ลงทะเบียนไว้ในระบบ</p>
                </div>
              </div>

              {forgotResult ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MailCheck size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">ส่งคำขอเรียบร้อยแล้ว</h4>
                  <p className="text-xs text-slate-600 mb-5 leading-relaxed">{forgotResult.message}</p>
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3 mt-3">
                  {forgotEmailError && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-2.5 rounded-xl border border-red-200">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{forgotEmailError}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">อีเมลของคุณ</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="เช่น student@utcc.ac.th หรือ yourname@gmail.com"
                      disabled={isForgotSubmitting}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      disabled={isForgotSubmitting}
                      className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isForgotSubmitting}
                      className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isForgotSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> กำลังส่ง...
                        </>
                      ) : (
                        'ส่งลิงก์รีเซ็ต'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
