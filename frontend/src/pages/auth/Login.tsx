/**
 * หน้าเข้าสู่ระบบและสมัครสมาชิกแบบครบวงจร (Unified Login & Registration)
 */
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import InstantForgotModal from './components/InstantForgotModal';
import DemoAccountsBox from './components/DemoAccountsBox';
import RegisterForm from './components/RegisterForm';

const GOOGLE_ERR_MAP: Record<string, string> = {
  demo_failed: 'ไม่สามารถเริ่มการเข้าสู่ระบบแบบจำลอง Google ได้',
  server_config: 'ยังไม่ได้ตั้งค่า Google OAuth ใน Backend',
  invalid_email: 'อีเมลไม่ได้รับอนุญาตในระบบ',
  access_denied: 'การยืนยันตัวตนด้วย Google ถูกยกเลิก',
};
const mapGoogleError = (code: string | null) => (code ? GOOGLE_ERR_MAP[code] || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google' : null);

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login: setAuthSession } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const googleErr = searchParams.get('googleError');
    if (googleErr) {
      setError(mapGoogleError(googleErr));
    }
  }, [searchParams]);

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError('กรุณากรอกรหัสผู้ใช้และรหัสผ่าน');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await authService.login(cleanId, password);
      setAuthSession(res.user, res.token);
      navigate(res.user.role === 'admin' ? '/admin' : '/student', { replace: true });
    } catch (err: unknown) {
      const errRes =
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message
          : null;
      setError(errRes || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsSocialLoading(true);
    window.location.href = authService.getGoogleLoginUrl();
  };

  return (
    <div className="min-h-screen w-full bg-[#061a12] bg-gradient-to-b from-[#082419] via-[#061c13] to-[#030e08] font-sans flex items-center justify-center p-3 sm:p-6 py-6 sm:py-10 relative overflow-y-auto overflow-x-hidden text-slate-100 selection:bg-emerald-500 selection:text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/15 via-transparent to-black/50 pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-[440px] sm:max-w-[460px] mx-auto flex flex-col items-center my-auto">
        {/* Brand Header */}
        <div className="w-full flex items-center justify-between mb-2.5">
          <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 shadow-md">
            <Leaf className="text-emerald-600" size={16} />
            <span className="text-xs font-black tracking-wider text-slate-900 uppercase">
              UTCC Sport<span className="text-emerald-600">®</span>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-800 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
            <Sparkles size={12} className="text-emerald-600" />
            <span>Sports Equipment Loan</span>
          </div>
        </div>

        {/* Main Card */}
        <motion.div
          className="w-full bg-white/95 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-2xl border border-white/80 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {/* Tabs */}
          <div className="flex bg-slate-100/90 p-1 rounded-2xl mb-4 border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div
                key="login-form"
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

                <form onSubmit={handleLoginSubmit} className="space-y-3" noValidate>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1" htmlFor="identifier">
                      รหัสนักศึกษา หรือ อีเมล
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      placeholder="เช่น 2410511101055 หรือ yourname@utcc.ac.th"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800" htmlFor="password">
                        รหัสผ่าน
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsForgotModalOpen(true)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="กรอกรหัสผ่านของคุณ"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-slate-900 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm mt-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> กำลังเข้าสู่ระบบ...
                      </>
                    ) : (
                      <>
                        เข้าสู่ระบบ <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

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

                {/* Google Sign In */}
                <div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isSocialLoading}
                    className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold py-2.5 px-4 rounded-xl border border-slate-300 shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer"
                  >
                    {isSocialLoading ? (
                      <Loader2 size={16} className="animate-spin text-slate-500" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    )}
                    <span>เข้าสู่ระบบด้วย Google</span>
                  </button>
                </div>

                <DemoAccountsBox
                  onSelectAccount={(userIdentifier, userPass) => {
                    setIdentifier(userIdentifier);
                    setPassword(userPass);
                  }}
                />
              </motion.div>
            ) : (
              <RegisterForm
                onGoogleSignIn={handleGoogleSignIn}
                isSocialLoading={isSocialLoading}
                onSuccess={() => {
                  // Redirected by AuthContext
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-[11px] text-white/90 font-medium mt-3 drop-shadow-xs flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} />
          <span>University of the Thai Chamber of Commerce • UTCC Sport</span>
        </div>
      </div>

      <InstantForgotModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialIdentifier={identifier}
        onResetSuccess={(newIdentifier) => {
          setIdentifier(newIdentifier);
          setPassword('');
          setMode('login');
        }}
      />
    </div>
  );
}
