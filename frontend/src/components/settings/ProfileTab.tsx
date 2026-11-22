/**
 * แท็บข้อมูลส่วนตัวและข้อมูลติดต่อใน SettingsModal
 */
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, BadgeCheck, Loader2 } from 'lucide-react';
import type { User } from '../../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0[0-9]{8,9}$/;

interface ProfileTabProps {
  user: User | null;
  onSave: (payload: { email?: string; phone?: string }) => Promise<void>;
  onClose: () => void;
}

export default function ProfileTab({ user, onSave, onClose }: ProfileTabProps) {
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; phone?: string } = {};

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      newErrors.email = 'กรุณากรอกรูปแบบอีเมลให้ถูกต้อง';
    }
    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      newErrors.phone = 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมีความยาว 9-10 หลัก';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await onSave({ email: cleanEmail || undefined, phone: cleanPhone || undefined });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      key="tab-profile"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.18 }}
    >
      <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 mb-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 font-medium">ชื่อ-นามสกุล</span>
          <span className="font-bold text-emerald-950 text-right">{user?.name || '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 font-medium">
            {isAdmin ? 'รหัสเจ้าหน้าที่ / บัญชี' : 'รหัสนักศึกษา'}
          </span>
          <span className="font-mono font-bold text-gray-800">{user?.studentId || '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 font-medium">อีเมลปัจจุบัน</span>
          <span className="font-medium text-gray-700 truncate max-w-[200px]">
            {user?.email || 'ยังไม่ได้ระบุ'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 font-medium">สิทธิ์การใช้งาน</span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
              isAdmin ? 'bg-emerald-900 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            <BadgeCheck size={11} />
            {isAdmin ? 'เจ้าหน้าที่ผู้ดูแลระบบ (Admin)' : 'นักศึกษา (Student)'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 text-xs" noValidate>
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
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="example@utcc.ac.th"
            disabled={isSaving}
            className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none ${
              errors.email ? 'border-red-400 bg-red-50/40' : 'border-gray-200'
            }`}
          />
          {errors.email && (
            <p className="text-red-600 text-[11px] font-semibold mt-1">{errors.email}</p>
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
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            placeholder="เช่น 0812345678"
            disabled={isSaving}
            className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none ${
              errors.phone ? 'border-red-400 bg-red-50/40' : 'border-gray-200'
            }`}
          />
          {errors.phone && (
            <p className="text-red-600 text-[11px] font-semibold mt-1">{errors.phone}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
          >
            ปิด
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 size={13} className="animate-spin" />}
            บันทึกข้อมูลติดต่อ
          </button>
        </div>
      </form>
    </motion.div>
  );
}
