/**
 * หน้าต่างตั้งค่าบัญชีผู้ใช้กลาง (แก้ไขอีเมล/เบอร์โทรติดต่อ และเปลี่ยนรหัสผ่าน)
 */
import { useState, useEffect, type FormEvent } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Mail,
  Phone,
  BadgeCheck,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import type { User } from '../types';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

type SettingsTab = 'profile' | 'security';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

interface PasswordStrength {
  score: number;
  label: string;
  colorClass: string;
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{8,9}$/;

// ดึงข้อความ Error จาก Axios Response หรือใช้ข้อความสำรอง
function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

// ประเมินระดับความแข็งแรงของรหัสผ่านใหม่ (ต่ำ / ปานกลาง / สูง)
function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasLetter && /[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  else if (hasLetter) score += 0.5;
  if (hasNumber) score += 1;
  if (hasSpecial) score += 1;

  if (!password) {
    return {
      score: 0,
      label: '',
      colorClass: 'bg-gray-200',
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSpecial,
    };
  }
  if (score < 2) {
    return {
      score: 1,
      label: 'ความปลอดภัยต่ำ',
      colorClass: 'bg-red-500',
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSpecial,
    };
  }
  if (score < 3.5) {
    return {
      score: 2,
      label: 'ความปลอดภัยปานกลาง',
      colorClass: 'bg-amber-500',
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSpecial,
    };
  }
  return {
    score: 3,
    label: 'ความปลอดภัยสูง',
    colorClass: 'bg-emerald-500',
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSpecial,
  };
}

// เนื้อหาภายในหน้าต่างตั้งค่า แบ่งแท็บข้อมูลบัญชีและความปลอดภัย
function SettingsContent({
  activeUser,
  onClose,
  onLogout,
  showToast,
}: {
  activeUser: User | null;
  onClose: () => void;
  onLogout?: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const { login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile tab state
  const [email, setEmail] = useState(activeUser?.email || '');
  const [phone, setPhone] = useState(activeUser?.phone || '');
  const [profileErrors, setProfileErrors] = useState<{ email?: string; phone?: string }>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security tab - Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const pwStrength = evaluatePasswordStrength(newPassword);

  // ตรวจสอบความถูกต้องและบันทึกอีเมล/เบอร์โทรศัพท์ติดต่อใหม่
  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const normalizedPhone = phone.replace(/[\s-]/g, '').trim();
    const errors: { email?: string; phone?: string } = {};

    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      errors.phone = 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก (ขึ้นต้นด้วย 0)';
    }

    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingProfile(true);
    try {
      const { message, user: updatedUser } = await authService.updateProfile({
        email: trimmedEmail,
        phone: normalizedPhone,
      });
      login(updatedUser);
      showToast('success', message || 'บันทึกข้อมูลบัญชีเรียบร้อยแล้ว');
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'ไม่สามารถบันทึกข้อมูลบัญชีได้'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ตรวจสอบเงื่อนไขรหัสผ่านและส่งคำขอเปลี่ยนรหัสผ่านไปยัง Backend
  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('กรุณากรอกรหัสผ่านปัจจุบัน');
      return;
    }
    if (!pwStrength.hasMinLength || !pwStrength.hasLetter || !pwStrength.hasNumber) {
      setPasswordError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรกับตัวเลข');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { message } = await authService.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      setPasswordError(msg);
      showToast('error', msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const isAdmin = activeUser?.role === 'admin';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pr-6">
        <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-2xl shrink-0">
          <Settings size={22} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black text-emerald-950 leading-tight">
            {isAdmin ? 'ตั้งค่าบัญชีเจ้าหน้าที่' : 'ตั้งค่าบัญชีผู้ใช้'}
          </h2>
          <p className="text-[11px] text-gray-500">
            จัดการข้อมูลติดต่อและเปลี่ยนรหัสผ่านบัญชีของคุณ
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-2xl mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-white text-emerald-950 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <UserIcon size={14} /> ข้อมูลบัญชี
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-white text-emerald-950 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShieldCheck size={14} /> ความปลอดภัย
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'profile' ? (
          <motion.div
            key="tab-profile"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18 }}
          >
            {/* Current User Info Summary */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500 font-medium">ชื่อ-นามสกุล</span>
                <span className="font-bold text-emerald-950 text-right">{activeUser?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500 font-medium">
                  {isAdmin ? 'รหัสเจ้าหน้าที่ / บัญชี' : 'รหัสนักศึกษา'}
                </span>
                <span className="font-mono font-bold text-gray-800">{activeUser?.studentId || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500 font-medium">อีเมลปัจจุบัน</span>
                <span className="font-medium text-gray-700 truncate max-w-[200px]">
                  {activeUser?.email || 'ยังไม่ได้ระบุ'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500 font-medium">สิทธิ์การใช้งาน</span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    isAdmin
                      ? 'bg-emerald-900 text-white'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <BadgeCheck size={11} />
                  {isAdmin ? 'เจ้าหน้าที่ผู้ดูแลระบบ (Admin)' : 'นักศึกษา (Student)'}
                </span>
              </div>
            </div>

            {/* Editable Contact Form */}
            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs" noValidate>
              <div>
                <label className="font-bold text-gray-700 mb-1 flex items-center gap-1.5" htmlFor="settings-email">
                  <Mail size={13} className="text-emerald-600" /> อีเมลติดต่อ
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (profileErrors.email) setProfileErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="example@utcc.ac.th"
                  disabled={isSavingProfile}
                  className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none ${
                    profileErrors.email ? 'border-red-400 bg-red-50/40' : 'border-gray-200'
                  }`}
                />
                {profileErrors.email && (
                  <p className="text-red-600 text-[11px] font-semibold mt-1">{profileErrors.email}</p>
                )}
              </div>

              <div>
                <label className="font-bold text-gray-700 mb-1 flex items-center gap-1.5" htmlFor="settings-phone">
                  <Phone size={13} className="text-emerald-600" /> เบอร์โทรศัพท์ติดต่อ
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (profileErrors.phone) setProfileErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder="เช่น 0812345678"
                  disabled={isSavingProfile}
                  className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none ${
                    profileErrors.phone ? 'border-red-400 bg-red-50/40' : 'border-gray-200'
                  }`}
                />
                {profileErrors.phone && (
                  <p className="text-red-600 text-[11px] font-semibold mt-1">{profileErrors.phone}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSavingProfile}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
                >
                  {isSavingProfile && <Loader2 size={13} className="animate-spin" />}
                  บันทึกข้อมูลติดต่อ
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="tab-security"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {/* 1. Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-3 text-xs" noValidate>
              <div className="flex items-center gap-1.5 font-black text-emerald-950 text-xs">
                <KeyRound size={14} className="text-emerald-600" /> เปลี่ยนรหัสผ่าน
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold px-3 py-2 rounded-xl flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
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
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                    disabled={isChangingPassword}
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
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="อย่างน้อย 8 ตัวอักษร (ตัวอักษร + ตัวเลข)"
                    disabled={isChangingPassword}
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

                {/* Password Strength Meter */}
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
                        {pwStrength.hasLetter ? '✓' : '○'} ตัวอักษร (A-Z)
                      </span>
                      <span className={pwStrength.hasNumber ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                        {pwStrength.hasNumber ? '✓' : '○'} ตัวเลข (0-9)
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
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    disabled={isChangingPassword}
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
                disabled={isChangingPassword}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-md inline-flex items-center justify-center gap-1.5"
              >
                {isChangingPassword && <Loader2 size={14} className="animate-spin" />}
                อัปเดตรหัสผ่านใหม่
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optional Logout Action */}
      {onLogout && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
              onLogout();
            }}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-all border border-red-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut size={15} /> ออกจากระบบ (Logout)
          </button>
        </div>
      )}
    </div>
  );
}

// คอมโพเนนต์หลักของ SettingsModal พร้อม Toast แจ้งเตือนผลการบันทึก
export default function SettingsModal({ isOpen, onClose, currentUser, onLogout }: SettingsModalProps) {
  const { user: authUser } = useAuth();
  const activeUser = currentUser ?? authUser;
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // แสดงแถบแจ้งเตือน (Toast) ชั่วคราวมุมขวาบน
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  return (
    <>
      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-[60] max-w-sm px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-100 shrink-0" />
            )}
            <span className="leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-1 opacity-75 hover:opacity-100 cursor-pointer"
              aria-label="ปิดการแจ้งเตือน"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
          >
            <motion.div
              className="bg-white/72 backdrop-blur-3xl backdrop-saturate-150 rounded-[2.2rem] p-5 sm:p-6 max-w-md w-full shadow-[0_28px_70px_rgba(15,23,42,0.28)] border border-white/80 ring-1 ring-white/50 relative my-auto max-h-[92vh] overflow-y-auto"
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>

              <SettingsContent
                key={`${activeUser?.id ?? 'guest'}-${activeUser?.email ?? ''}-${activeUser?.phone ?? ''}`}
                activeUser={activeUser}
                onClose={onClose}
                onLogout={onLogout}
                showToast={showToast}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
