/**
 * หน้าเข้าสู่ระบบและสมัครสมาชิก UTCC Sport (Clean High-Contrast Vertical Layout)
 * ดีไซน์คลีน คมชัด อ่านง่าย ฟอร์มแนวตั้งเดี่ยว พร้อมระบบรีเซ็ตรหัสผ่าน 2 ขั้นตอนทันที
 */
import { useState, useContext, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  KeyRound,
  UserPlus,
  LogIn,
  ArrowLeft,
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

  // Register State (จัดเรียงแนวตั้งเดี่ยว Single Column พร้อมแยกชื่อ-นามสกุล)
  const [regStudentId, setRegStudentId] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Instant Forgot Password Modal State (Step 1: ตรวจสอบข้อมูล -> Step 2: ตั้งรหัสใหม่ -> Step 3: สำเร็จ)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStudentId, setForgotStudentId] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotUserName, setForgotUserName] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

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

  // สมัครสมาชิกใหม่ (สำหรับสิทธิ์ student) - รวม firstName + lastName ส่งเป็น name
  const handleRegisterSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegError(null);

    const idTrimmed = regStudentId.trim();
    const firstTrimmed = regFirstName.trim();
    const lastTrimmed = regLastName.trim();
    const emailTrimmed = regEmail.trim().toLowerCase();

    if (!idTrimmed || idTrimmed.length < 4) {
      setRegError('กรุณากรอกรหัสนักศึกษาให้ถูกต้อง (เช่น 2410511101055)');
      return;
    }
    if (!firstTrimmed) {
      setRegError('กรุณากรอกชื่อจริง');
      return;
    }
    if (!lastTrimmed) {
      setRegError('กรุณากรอกนามสกุล');
      return;
    }
    if (!emailTrimmed || !EMAIL_REGEX.test(emailTrimmed)) {
      setRegError('กรุณากรอกอีเมลที่ถูกต้อง (รองรับทั้ง @gmail.com และ @live4.utcc.ac.th)');
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

    const fullName = `${firstTrimmed} ${lastTrimmed}`.trim();

    setIsRegistering(true);
    try {
      const { token, user } = await authService.register({
        studentId: idTrimmed,
        name: fullName,
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

  // เติมโดเมนอีเมลให้อัตโนมัติเมื่อกดชิปแนะนำ
  const applyDomainSuffix = (domain: string) => {
    const base = regEmail.split('@')[0] || regStudentId || 'student';
    setRegEmail(`${base}@${domain}`);
    setRegError(null);
  };

  // เปิด/ปิด Modal รีเซ็ตรหัสผ่านแบบทันที
  const openForgotModal = () => {
    setForgotStep(1);
    setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
    setForgotStudentId(!identifier.includes('@') ? identifier.trim() : '');
    setForgotToken('');
    setForgotUserName('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError(null);
    setIsForgotModalOpen(true);
  };

  const closeForgotModal = () => {
    if (isForgotSubmitting) return;
    setIsForgotModalOpen(false);
  };

  // ขั้นตอนที่ 1: ตรวจสอบอีเมล + รหัสนักศึกษา กับฐานข้อมูล
  const handleVerifyIdentity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = forgotEmail.trim().toLowerCase();
    const trimmedId = forgotStudentId.trim();

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setForgotError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (!trimmedId) {
      setForgotError('กรุณากรอกรหัสนักศึกษา หรือชื่อบัญชี');
      return;
    }

    setForgotError(null);
    setIsForgotSubmitting(true);
    try {
      const res = await authService.verifyResetIdentity(trimmedEmail, trimmedId);
      setForgotToken(res.token);
      setForgotUserName(res.name || 'ผู้ใช้งาน');
      setForgotStep(2);
    } catch (err) {
      setForgotError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่พบข้อมูลที่ตรงกันในระบบ กรุณาตรวจสอบอีเมลและรหัสนักศึกษา'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่'
      );
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  // ขั้นตอนที่ 2: ตั้งรหัสผ่านใหม่และบันทึกลงฐานข้อมูลทันที
  const handleResetPasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (forgotNewPassword.length < 6) {
      setForgotError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setForgotError(null);
    setIsForgotSubmitting(true);
    try {
      await authService.instantResetPassword({
        token: forgotToken,
        email: forgotEmail.trim().toLowerCase(),
        studentId: forgotStudentId.trim(),
        newPassword: forgotNewPassword,
      });
      setForgotStep(3);
    } catch (err) {
      setForgotError(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่'
      );
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#89a9ba] bg-cover bg-center bg-fixed font-sans flex items-center justify-center p-3 sm:p-6 py-6 sm:py-10 relative overflow-y-auto overflow-x-hidden"
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      {/* Background Soft Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900/30 via-emerald-950/25 to-slate-950/50 backdrop-blur-[2px] pointer-events-none z-0" />

      {/* Centered Column (Wraps Top Bar, Main Card, and Footer for all screen sizes) */}
      <div className="relative z-10 w-full max-w-[440px] sm:max-w-[460px] mx-auto flex flex-col items-center my-auto">
        {/* Top Floating Mini Brand Pill */}
        <div className="w-full flex items-center justify-between mb-2.5">
          <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 shadow-md">
            <Leaf className="text-emerald-600" size={16} />
            <span className="text-xs font-black tracking-wider text-slate-900 uppercase">
              UTCC Sport<span className="text-emerald-600">®</span>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-800 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
            <ShieldCheck size={14} className="text-emerald-700" />
            <span>ระบบยืม-คืนอุปกรณ์กีฬา</span>
          </div>
        </div>

        {/* Main Card (High Contrast Clean White Card) */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-7 flex flex-col"
        >
          {/* Brand Icon & Welcome Title */}
          <div className="text-center mb-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto mb-2.5 shadow-md shadow-emerald-600/20">
              <Leaf size={22} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'เข้าสู่ระบบ UTCC Sport' : 'สมัครสมาชิกใหม่'}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {mode === 'login'
                ? 'ระบบยืม-คืนอุปกรณ์กีฬาออนไลน์ มหาวิทยาลัยหอการค้าไทย'
                : 'กรอกข้อมูลนักศึกษาของคุณเพื่อเริ่มต้นใช้งาน'}
            </p>
          </div>

          {/* Minimal Tab Switcher Pill */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-4 text-xs sm:text-sm font-bold border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setRegError(null);
                setApiError(null);
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus size={15} /> สมัครสมาชิก
            </button>
          </div>

          {/* Global Error Banner */}
          {apiError && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-2xl mb-3 shadow-2xs"
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
              transition={{ duration: 0.16 }}
            >
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5" htmlFor="identifier">
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
                    className={`w-full px-4 py-3 rounded-2xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all ${
                      fieldErrors.identifier ? 'border-red-400' : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.identifier && (
                    <p className="text-red-600 text-[11px] font-semibold mt-1">{fieldErrors.identifier}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800" htmlFor="password">
                      รหัสผ่าน
                    </label>
                    <button
                      type="button"
                      onClick={openForgotModal}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline bg-transparent border-none cursor-pointer"
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
                      className={`w-full px-4 py-3 pr-11 rounded-2xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all ${
                        fieldErrors.password ? 'border-red-400' : 'border-slate-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1.5"
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
                  className="w-full bg-slate-900 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm mt-2"
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
                  <span className="bg-white px-2.5 text-slate-500 font-semibold">
                    หรือเข้าสู่ระบบด้วย
                  </span>
                </div>
              </div>

              {/* Social Login: Full Width Google Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isSocialLoading !== null}
                  className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold py-3 px-4 rounded-2xl border border-slate-300 shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer"
                >
                  {isSocialLoading === 'google' ? (
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
                  <span>เข้าสู่ระบบด้วย Google</span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* ==================== REGISTER FORM (Single Column Vertical Layout) ==================== */
            <motion.div
              key="minimal-register"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {regError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-2xl mb-3 shadow-2xs">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              {/* ฟอร์มแนวตั้ง 1 ช่องต่อ 1 บรรทัด เรียงลำดับชัดเจน สะอาดตา */}
              <form onSubmit={handleRegisterSubmit} className="space-y-2.5 sm:space-y-3 text-xs" noValidate>
                {/* รหัสนักศึกษา */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1" htmlFor="regStudentId">
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
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                  />
                </div>

                {/* ชื่อจริง */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1" htmlFor="regFirstName">
                    ชื่อจริง
                  </label>
                  <input
                    id="regFirstName"
                    type="text"
                    placeholder="กรอกชื่อจริงของคุณ"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    disabled={isRegistering}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                  />
                </div>

                {/* นามสกุล */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1" htmlFor="regLastName">
                    นามสกุล
                  </label>
                  <input
                    id="regLastName"
                    type="text"
                    placeholder="กรอกนามสกุลของคุณ"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    disabled={isRegistering}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                  />
                </div>

                {/* อีเมลติดต่อ (พร้อมปุ่มเติมโดเมนอัตโนมัติ) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800" htmlFor="regEmail">
                      อีเมลติดต่อ
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyDomainSuffix('gmail.com')}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full cursor-pointer transition-colors border border-slate-200"
                      >
                        @gmail.com
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDomainSuffix('live4.utcc.ac.th')}
                        className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full cursor-pointer transition-colors border border-emerald-200"
                      >
                        @live4.utcc.ac.th
                      </button>
                    </div>
                  </div>
                  <input
                    id="regEmail"
                    type="email"
                    placeholder="yourname@gmail.com หรือ @live4.utcc.ac.th"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={isRegistering}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                  />
                </div>

                {/* รหัสผ่าน (6+ ตัวอักษร) พร้อมปุ่มเปิด-ปิดตา */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1" htmlFor="regPassword">
                    รหัสผ่าน (6+ ตัวอักษร)
                  </label>
                  <div className="relative">
                    <input
                      id="regPassword"
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      disabled={isRegistering}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      tabIndex={-1}
                      aria-label={showRegPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* ยืนยันรหัสผ่าน พร้อมปุ่มเปิด-ปิดตา */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1" htmlFor="regConfirm">
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      id="regConfirm"
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      placeholder="กรอกรหัสผ่านเดิมอีกครั้ง"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      disabled={isRegistering}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      tabIndex={-1}
                      aria-label={showRegConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm mt-2"
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

              {/* Full Width Google Button for Register */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isRegistering || isSocialLoading !== null}
                  className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold py-2.5 px-3 rounded-2xl border border-slate-300 shadow-xs flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                  <span>สมัครด้วย Google</span>
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
            <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs font-mono space-y-1">
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
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px]">admin1234</span>
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
        <div className="text-center text-[11px] text-white/90 font-medium mt-3 drop-shadow-xs">
          University of the Thai Chamber of Commerce • UTCC Sport
        </div>
      </div>

      {/* ==================== 2-STEP INSTANT FORGOT PASSWORD MODAL ==================== */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={closeForgotModal}
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
                onClick={closeForgotModal}
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
                    {forgotStep === 1
                      ? 'ลืมรหัสผ่าน (ขั้นตอนที่ 1/2)'
                      : forgotStep === 2
                      ? 'ตั้งรหัสผ่านใหม่ (ขั้นตอนที่ 2/2)'
                      : 'เปลี่ยนรหัสผ่านสำเร็จ'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {forgotStep === 1
                      ? 'ยืนยันตัวตนด้วยอีเมลและรหัสนักศึกษา'
                      : forgotStep === 2
                      ? `ผู้ใช้งาน: ${forgotUserName}`
                      : 'คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที'}
                  </p>
                </div>
              </div>

              {/* Error Alert in Modal */}
              {forgotError && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-2.5 rounded-xl border border-red-200 mb-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* STEP 1: ยืนยันตัวตน (อีเมล + รหัสนักศึกษา) */}
              {forgotStep === 1 && (
                <form onSubmit={handleVerifyIdentity} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      อีเมลของคุณ
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="เช่น yourname@gmail.com หรือ student@utcc.ac.th"
                      disabled={isForgotSubmitting}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      รหัสนักศึกษา / บัญชีผู้ใช้
                    </label>
                    <input
                      type="text"
                      value={forgotStudentId}
                      onChange={(e) => setForgotStudentId(e.target.value)}
                      placeholder="เช่น 2410511101055 หรือ admin"
                      disabled={isForgotSubmitting}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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
                      className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isForgotSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> กำลังตรวจสอบ...
                        </>
                      ) : (
                        <>
                          ตรวจสอบข้อมูล <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: ตั้งรหัสผ่านใหม่ (รหัสผ่านใหม่ + ยืนยันรหัสผ่านใหม่) */}
              {forgotStep === 2 && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs text-emerald-900 font-medium">
                    ✓ ยืนยันตัวตนสำเร็จ: <strong>{forgotUserName}</strong>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      รหัสผ่านใหม่ (6+ ตัวอักษร)
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="ตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                        disabled={isForgotSubmitting}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotConfirmPassword ? 'text' : 'password'}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                        disabled={isForgotSubmitting}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirmPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showForgotConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      disabled={isForgotSubmitting}
                      className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ArrowLeft size={13} /> ย้อนกลับ
                    </button>
                    <button
                      type="submit"
                      disabled={isForgotSubmitting}
                      className="w-2/3 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isForgotSubmitting ? (
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

              {/* STEP 3: แจ้งเตือนสำเร็จพร้อมเข้าสู่ระบบ */}
              {forgotStep === 3 && (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1">เปลี่ยนรหัสผ่านสำเร็จ!</h4>
                  <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                    ระบบได้อัปเดตรหัสผ่านใหม่ของคุณเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้ทันที
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(forgotStudentId || forgotEmail);
                      setPassword('');
                      setMode('login');
                      closeForgotModal();
                    }}
                    className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    เข้าสู่ระบบด้วยรหัสผ่านใหม่ <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
