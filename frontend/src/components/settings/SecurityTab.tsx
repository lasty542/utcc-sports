/**
 * แท็บความปลอดภัยและเปลี่ยนรหัสผ่านใน SettingsModal
 */
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface SecurityTabProps {
  onSavePassword: (currentPw: string, newPw: string) => Promise<void>;
}

interface PasswordStrength {
  score: 1 | 2 | 3;
  label: string;
  colorClass: string;
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let passedRules = 0;
  if (hasMinLength) passedRules++;
  if (hasLetter) passedRules++;
  if (hasNumber) passedRules++;
  if (hasSpecial) passedRules++;

  if (passedRules >= 4 && password.length >= 10) {
    return {
      score: 3,
      label: 'รัดกุมมาก',
      colorClass: 'bg-emerald-600',
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSpecial,
    };
  }
  if (passedRules >= 3) {
    return {
      score: 2,
      label: 'ปานกลาง',
      colorClass: 'bg-amber-500',
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSpecial,
    };
  }
  return {
    score: 1,
    label: 'ง่ายเกินไป',
    colorClass: 'bg-red-500',
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSpecial,
  };
}

export default function SecurityTab({ onSavePassword }: SecurityTabProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pwStrength = evaluatePasswordStrength(newPassword);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError('กรุณากรอกรหัสผ่านปัจจุบัน');
      return;
    }
    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('รหัสผ่านใหม่ต้องประกอบด้วยตัวอักษรและตัวเลข');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSavePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      key="tab-security"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      className="space-y-5"
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs" noValidate>
        <div className="flex items-center gap-1.5 font-black text-emerald-950 text-xs">
          <KeyRound size={14} className="text-emerald-600" /> เปลี่ยนรหัสผ่าน
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold px-3 py-2 rounded-xl flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="font-bold text-gray-700 mb-1 block" htmlFor="current-pw">
            รหัสผ่านปัจจุบัน
          </label>
          <div className="relative">
            <input
              id="current-pw"
              type={showCurrentPw ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="กรอกรหัสผ่านปัจจุบัน"
              disabled={isSubmitting}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-9 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPw((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              tabIndex={-1}
            >
              {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="font-bold text-gray-700 mb-1 block" htmlFor="new-pw">
            รหัสผ่านใหม่
          </label>
          <div className="relative">
            <input
              id="new-pw"
              type={showNewPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="อย่างน้อย 8 ตัวอักษร (ตัวอักษร + ตัวเลข)"
              disabled={isSubmitting}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-9 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowNewPw((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              tabIndex={-1}
            >
              {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {newPassword && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-gray-500">ระดับความปลอดภัย</span>
                <span
                  className={
                    pwStrength.score === 3
                      ? 'text-emerald-700'
                      : pwStrength.score === 2
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }
                >
                  {pwStrength.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 h-1.5">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`rounded-full transition-colors ${
                      pwStrength.score >= step ? pwStrength.colorClass : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                <span className={pwStrength.hasMinLength ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                  {pwStrength.hasMinLength ? '✓' : '○'} 8+ ตัวอักษร
                </span>
                <span className={pwStrength.hasLetter ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                  {pwStrength.hasLetter ? '✓' : '○'} ตัวอักษร
                </span>
                <span className={pwStrength.hasNumber ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                  {pwStrength.hasNumber ? '✓' : '○'} ตัวเลข
                </span>
                <span className={pwStrength.hasSpecial ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                  {pwStrength.hasSpecial ? '✓' : '○'} อักขระพิเศษ
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="font-bold text-gray-700 mb-1 block" htmlFor="confirm-pw">
            ยืนยันรหัสผ่านใหม่
          </label>
          <div className="relative">
            <input
              id="confirm-pw"
              type={showConfirmPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              disabled={isSubmitting}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-9 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPw((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              tabIndex={-1}
            >
              {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-md inline-flex items-center justify-center gap-1.5"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          อัปเดตรหัสผ่านใหม่
        </button>
      </form>
    </motion.div>
  );
}
