/**
 * หน้าต่างตั้งค่าบัญชีผู้ใช้และเปลี่ยนรหัสผ่าน (Settings Modal)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, User as UserIcon, Shield, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService, type User } from '../services/authService';
import ProfileTab from './settings/ProfileTab';
import SecurityTab from './settings/SecurityTab';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

type SettingsTab = 'profile' | 'security';

export default function SettingsModal({ isOpen, onClose, currentUser, onLogout }: SettingsModalProps) {
  const { user: authUser, setUser: setAuthUser, logout } = useAuth();
  const activeUser = currentUser ?? authUser;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 3500);
  };

  const handleSaveProfile = async (payload: { email?: string; phone?: string }) => {
    try {
      const res = await authService.updateProfile(payload);
      setAuthUser(res.user);
      showToast('success', 'บันทึกข้อมูลติดต่อเรียบร้อยแล้ว');
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'ไม่สามารถบันทึกข้อมูลได้';
      showToast('error', msg || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      throw err;
    }
  };

  const handleSavePassword = async (currentPw: string, newPw: string) => {
    try {
      const res = await authService.changePassword(currentPw, newPw);
      showToast('success', res.message || 'เปลี่ยนรหัสผ่านสำเร็จ');
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
      showToast('error', msg || 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
      throw new Error(msg || 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-2xl relative border border-slate-200"
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ตั้งค่าบัญชี</h3>
                  <p className="text-[11px] text-slate-500">จัดการข้อมูลส่วนตัวและความปลอดภัย</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Nav */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserIcon size={13} /> ข้อมูลติดต่อ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shield size={13} /> รหัสผ่าน
              </button>
            </div>

            {/* Toast */}
            {toast && (
              <div
                className={`flex items-start gap-2 text-xs p-2.5 rounded-xl border mb-3 ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {toast.type === 'success' ? (
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                )}
                <span>{toast.message}</span>
              </div>
            )}

            {/* Active Tab */}
            {activeTab === 'profile' ? (
              <ProfileTab user={activeUser} onSave={handleSaveProfile} onClose={onClose} />
            ) : (
              <SecurityTab onSavePassword={handleSavePassword} />
            )}

            {/* Logout Action */}
            {onLogout && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                    onLogout();
                  }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 px-4 rounded-xl text-xs transition-all border border-red-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> ออกจากระบบ
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
