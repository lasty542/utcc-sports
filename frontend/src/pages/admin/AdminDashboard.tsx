/**
 * หน้าแดชบอร์ดหลักของเจ้าหน้าที่ (Admin Dashboard)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldAlert,
  QrCode,
  Package,
  Users,
  Settings,
  LogOut,
  Activity,
  Bell,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import ScannerModal from './components/ScannerModal';
import SettingsModal from '../../components/SettingsModal';
import NotificationsModal from './components/NotificationsModal';
import RecentLogsTable from './components/RecentLogsTable';
import AdminActionCards from './components/AdminActionCards';
import { listBorrows, type BorrowItem } from '../../services/borrowService';
import { subscribeBorrowUpdated } from '../../utils/realtime';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [allBorrows, setAllBorrows] = useState<BorrowItem[]>([]);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  const fetchBorrows = useCallback(async () => {
    try {
      const data = await listBorrows();
      setAllBorrows(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchBorrows();
    const unsubscribe = subscribeBorrowUpdated(() => {
      void fetchBorrows();
    });
    return () => {
      unsubscribe();
    };
  }, [fetchBorrows]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const freshList = await listBorrows();
        setAllBorrows((prevList) => {
          if (prevList.length > 0) {
            if (freshList.length > prevList.length) {
              const newest = freshList[0];
              setRealtimeToast(`มีคำขอยืมใหม่: ${newest.equipment} (${newest.userName})`);
              setTimeout(() => setRealtimeToast(null), 4500);
            } else {
              for (const fresh of freshList) {
                const old = prevList.find((p) => p.id === fresh.id);
                if (old && old.status !== fresh.status) {
                  setRealtimeToast(`อัปเดตสถานะ: ${fresh.equipment} (${fresh.studentId}) เป็น "${fresh.status}"`);
                  setTimeout(() => setRealtimeToast(null), 4500);
                  break;
                }
              }
            }
          }
          return freshList;
        });
      } catch {
        // silent
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const activeBorrowCount = allBorrows.filter(
    (b) => b.statusType === 'borrowing' || b.statusType === 'pending' || b.statusType === 'overdue'
  ).length;

  const recentLogs = allBorrows.slice(0, 5);

  return (
    <div className="min-h-screen w-full bg-[#061a12] bg-gradient-to-b from-[#082419] via-[#061c13] to-[#030e08] font-sans text-slate-100 p-4 sm:p-6 lg:p-8 relative selection:bg-emerald-500 selection:text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/12 via-transparent to-black/40 pointer-events-none z-0" />

      {/* Realtime Toast */}
      <AnimatePresence>
        {realtimeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-xl text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/20 text-xs font-bold"
          >
            <Sparkles size={16} className="text-amber-400 shrink-0" />
            <span>{realtimeToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto pb-32">
        {/* Top Capsule Header */}
        <motion.header
          className="bg-white/85 backdrop-blur-2xl rounded-full px-4 sm:px-5 py-2 sm:py-2.5 shadow-xl border border-white/80 flex items-center justify-between mb-4 sm:mb-5"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            <span className="font-black text-xs sm:text-sm tracking-widest text-slate-900 uppercase">
              UTCC SPORT
            </span>
            <span className="bg-slate-900/10 text-slate-800 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-900/15">
              STAFF ADMIN
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/70 hover:bg-white text-slate-800 flex items-center justify-center cursor-pointer transition-all shadow-sm"
              title="ตั้งค่าระบบ"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={() => setIsNotiOpen(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/70 hover:bg-white text-slate-800 flex items-center justify-center relative cursor-pointer transition-all shadow-sm"
              title="การแจ้งเตือน"
            >
              <Bell size={15} />
              {activeBorrowCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500/80 hover:bg-red-600 backdrop-blur-xl border border-white/40 text-white flex items-center justify-center cursor-pointer shadow-lg"
              title="ออกจากระบบ"
            >
              <LogOut size={14} />
            </button>
          </div>
        </motion.header>

        {/* Welcome Hero Card */}
        <motion.div
          className="bg-[#f6e3ba]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 shadow-xl border border-white/75 mb-5 sm:mb-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <span className="bg-slate-900 text-white text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 mb-2 uppercase tracking-wider">
                <ShieldAlert size={11} /> Staff Control Center
              </span>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 mb-0.5">
                ศูนย์ควบคุมงานกีฬา, {user?.name || 'Admin'}
              </h1>
              <p className="text-slate-700 text-xs sm:text-sm leading-relaxed max-w-xl">
                ตรวจสอบรายการยืม-คืน สแกนคิวอาร์โค้ด และจัดการคลังอุปกรณ์กีฬาแบบเรียลไทม์
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 shrink-0 shadow-sm">
              <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-sm">
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  กำลังยืมขณะนี้
                </p>
                <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                  {activeBorrowCount}{' '}
                  <span className="text-xs font-bold text-slate-600">รายการ</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bento Action Cards */}
        <AdminActionCards
          onOpenScanner={() => setIsScannerOpen(true)}
          onNavigate={(path) => navigate(path)}
        />

        {/* Recent Logs Table */}
        <RecentLogsTable logs={recentLogs} />

        {/* Bottom Floating Navigation Dock */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/95 backdrop-blur-2xl px-3 py-2 rounded-full border border-emerald-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-emerald-500 transition-all"
              title="แดชบอร์ดหลัก"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 hover:bg-emerald-600 text-emerald-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="สแกน QR"
            >
              <QrCode size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/inventory')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 hover:bg-emerald-600 text-emerald-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="คลังอุปกรณ์"
            >
              <Package size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/borrow-logs')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 hover:bg-emerald-600 text-emerald-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="รายการยืม-คืน"
            >
              <Users size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 hover:bg-emerald-600 text-emerald-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="ตั้งค่า"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={() => void fetchBorrows()}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={user}
        onLogout={handleLogout}
      />

      <NotificationsModal
        isOpen={isNotiOpen}
        onClose={() => setIsNotiOpen(false)}
        activeCount={activeBorrowCount}
      />
    </div>
  );
}
