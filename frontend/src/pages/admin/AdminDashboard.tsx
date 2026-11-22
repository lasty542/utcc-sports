/**
 * หน้าแดชบอร์ดหลักของเจ้าหน้าที่ (Admin) สำหรับสแกน QR, จัดการคลัง, ดูความเคลื่อนไหวล่าสุด และตั้งค่า
 */
// src/pages/Admin/AdminDashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldAlert,
  QrCode,
  Package,
  Users,
  ArrowUpRight,
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
import { listBorrows, type BorrowItem } from '../../services/borrowService';
import { notifyBorrowUpdated, subscribeBorrowUpdated } from '../../utils/realtime';

const SCENIC_MEADOW_BG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop';

// คอมโพเนนต์หน้าศูนย์ควบคุมของเจ้าหน้าที่
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [allBorrows, setAllBorrows] = useState<BorrowItem[]>([]);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  // โหลดรายการยืมล่าสุดเพื่ออัปเดตตัวเลขและตารางบนแดชบอร์ด
  const fetchBorrows = useCallback(async () => {
    try {
      const data = await listBorrows();
      setAllBorrows(data);
    } catch {
      // ถ้าโหลดไม่ได้ก็ใช้ข้อมูลเดิม
    }
  }, []);

  useEffect(() => {
    let active = true;
    listBorrows()
      .then((data) => {
        if (active) setAllBorrows(data);
      })
      .catch(() => {
        // ถ้าโหลดไม่ได้ก็ใช้ข้อมูลเดิม
      });

    // เชื่อมต่อการแจ้งเตือน Real-time ข้ามแท็บ
    const unsubscribe = subscribeBorrowUpdated(() => {
      void fetchBorrows();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchBorrows]);

  // Real-time Auto-polling ทุกๆ 3.5 วินาที เพื่อดึงรายการล่าสุดและแจ้งเตือนเมื่อมีการยืม/คืน
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const freshList = await listBorrows();
        setAllBorrows((prevList) => {
          if (prevList.length > 0) {
            // เช็คว่ามีรายการขอยืมใหม่เข้ามาหรือไม่
            if (freshList.length > prevList.length) {
              const newest = freshList[0];
              setRealtimeToast(`มีคำขอยืมใหม่: ${newest.equipment} (${newest.userName})`);
              setTimeout(() => setRealtimeToast(null), 4500);
            } else {
              // เช็คการเปลี่ยนสถานะ
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
        // Polling silent fail
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const activeBorrowCount = allBorrows.filter(
    (item) =>
      item.statusType === 'pending' ||
      item.statusType === 'borrowing' ||
      item.statusType === 'overdue'
  ).length;

  const recentLogs = allBorrows.slice(0, 3);

  // ยืนยันการออกจากระบบสำหรับเจ้าหน้าที่และพากลับไปหน้า Login
  const handleLogout = () => {
    if (confirm('คุณต้องการออกจากระบบผู้ดูแลใช่หรือไม่?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#89a9ba] bg-cover bg-center bg-fixed font-sans pb-28 relative overflow-x-hidden text-slate-900"
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      <div className="fixed inset-0 bg-gradient-to-b from-sky-900/15 via-emerald-950/10 to-emerald-950/35 pointer-events-none z-0" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-7 pt-5">
        {/* Real-time Dynamic Toast Notification for Staff */}
        <AnimatePresence>
          {realtimeToast && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="mb-4 bg-emerald-950/90 text-white backdrop-blur-xl border border-emerald-400/40 px-5 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-xs font-bold"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center shrink-0">
                  <Sparkles size={14} />
                </span>
                <span>{realtimeToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setRealtimeToast(null)}
                className="text-emerald-300 hover:text-white text-[11px] font-normal cursor-pointer"
              >
                ปิด
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Floating iPadOS Bar + Dynamic Island */}
        <motion.header
          className="flex flex-wrap items-center justify-between gap-3 mb-7"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/85 backdrop-blur-xl border-2 border-white shadow-lg flex items-center justify-center font-black text-emerald-900 text-sm">
              {user?.name ? user.name.charAt(0) : 'A'}
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-white/30 hover:bg-white/45 backdrop-blur-2xl backdrop-saturate-150 text-white border border-white/45 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Settings size={14} /> Settings
            </button>
          </div>

          {/* Center Dynamic Island */}
          <button
            type="button"
            onClick={() => setIsNotiOpen(true)}
            className="hidden lg:flex items-center gap-3 bg-white/82 hover:bg-white/95 backdrop-blur-2xl backdrop-saturate-150 px-4 py-1.5 rounded-full shadow-[0_12px_32px_rgba(15,23,42,0.16)] border border-white/80 transition-all cursor-pointer"
          >
            <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center">
              <Activity size={13} />
            </span>
            <div className="text-left">
              <p className="text-[11px] font-black text-slate-900 leading-tight">
                Staff Control Center
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                กำลังยืมอยู่ {activeBorrowCount} รายการ
              </p>
            </div>
            {activeBorrowCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/25 backdrop-blur-2xl border border-white/40 p-1 rounded-full shadow-lg">
              <button
                onClick={() => navigate('/admin')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-white text-slate-900 shadow-sm cursor-pointer"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/inventory')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-full text-white/90 hover:text-white cursor-pointer"
              >
                Inventory
              </button>
              <button
                onClick={() => navigate('/admin/borrow-logs')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-full text-white/90 hover:text-white cursor-pointer hidden sm:block"
              >
                Logs
              </button>
            </div>
            <button
              onClick={() => setIsNotiOpen(true)}
              className="relative w-9 h-9 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-2xl border border-white/45 text-white flex items-center justify-center cursor-pointer shadow-lg"
              title="การแจ้งเตือน"
            >
              <Bell size={15} />
              {activeBorrowCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-red-500/80 hover:bg-red-600 backdrop-blur-xl border border-white/40 text-white flex items-center justify-center cursor-pointer shadow-lg"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
            </button>
          </div>
        </motion.header>

        {/* Welcome Editorial Hero */}
        <motion.div
          className="bg-[#f6e3ba]/95 backdrop-blur-2xl rounded-[2.2rem] p-6 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.16)] border border-white/75 mb-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-2.5 uppercase tracking-wider">
                <ShieldAlert size={12} /> Staff Control Center
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mb-1">
                ศูนย์ควบคุมงานกีฬา, {user?.name || 'Admin'}
              </h1>
              <p className="text-slate-700 text-xs sm:text-sm leading-relaxed max-w-xl">
                ตรวจสอบรายการยืม-คืน สแกนคิวอาร์โค้ด และจัดการคลังอุปกรณ์กีฬาแบบเรียลไทม์
              </p>
            </div>

            <div className="bg-white/75 backdrop-blur-xl border border-white rounded-[1.6rem] p-4 flex items-center gap-3.5 shrink-0 shadow-sm">
              <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  กำลังยืมขณะนี้
                </p>
                <p className="text-xl font-black text-slate-900 leading-tight">
                  {activeBorrowCount}{' '}
                  <span className="text-xs font-bold text-slate-600">รายการ</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Squircle Bento Action Cards (Mix of Frosted Glass + White + Vibrant) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {/* Card 1: White Crisp */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white/86 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] p-6 shadow-[0_18px_42px_rgba(15,23,42,0.14)] border border-white/85 flex flex-col justify-between"
          >
            <div>
              <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-md inline-block mb-3">
                <QrCode size={22} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">สแกน QR Code นักศึกษา</h3>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                เปิดกล้องสแกนรหัสเพื่อบันทึกการรับหรือคืนอุปกรณ์กีฬาหน้าเคาน์เตอร์
              </p>
            </div>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              เริ่มสแกนเลย <ArrowUpRight size={15} />
            </button>
          </motion.div>

          {/* Card 2: Frosted Glass Translucent Tile (Image 1 style) */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white/25 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] p-6 shadow-[0_18px_42px_rgba(15,23,42,0.16)] border border-white/45 text-white flex flex-col justify-between"
          >
            <div>
              <div className="bg-white/25 text-white p-3 rounded-2xl inline-block mb-3 border border-white/35">
                <Package size={22} />
              </div>
              <h3 className="text-lg font-black mb-1 drop-shadow-sm">จัดการคลังอุปกรณ์</h3>
              <p className="text-xs text-white/85 mb-5 leading-relaxed">
                เพิ่ม ลด หรือแก้ไขจำนวนและสถานะอุปกรณ์กีฬาทั้งหมดในระบบ
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/inventory')}
              className="w-full bg-white text-slate-900 hover:bg-emerald-50 font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              จัดการคลัง <ArrowUpRight size={15} />
            </button>
          </motion.div>

          {/* Card 3: Vibrant Orange Accent Tile (Image 2 style) */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-[#ff5722]/95 backdrop-blur-xl rounded-[2.2rem] p-6 shadow-[0_18px_42px_rgba(255,87,34,0.28)] border border-white/35 text-white flex flex-col justify-between sm:col-span-2 lg:col-span-1"
          >
            <div>
              <div className="bg-black/15 text-white p-3 rounded-2xl inline-block mb-3">
                <Users size={22} />
              </div>
              <h3 className="text-lg font-black mb-1">ตรวจสอบสถานะการยืม</h3>
              <p className="text-xs text-white/85 mb-5 leading-relaxed">
                ดูรายชื่อนักศึกษาที่ยังไม่คืนอุปกรณ์ หรือรายการที่เกินกำหนด
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/borrow-logs')}
              className="w-full bg-white text-slate-900 hover:bg-orange-50 font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              ดูรายการผู้ยืม <ArrowUpRight size={15} />
            </button>
          </motion.div>
        </div>

        {/* ตารางแสดงรายการยืมล่าสุด */}
        <RecentLogsTable logs={recentLogs} />

        {/* Bottom Floating iPadOS Glass Dock */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 bg-white/30 backdrop-blur-2xl backdrop-saturate-150 px-3 py-2 rounded-full border border-white/50 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform"
              title="Dashboard"
            >
              <LayoutGrid size={17} />
            </button>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
              title="สแกน QR"
            >
              <QrCode size={17} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/inventory')}
              className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
              title="คลังอุปกรณ์"
            >
              <Package size={17} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/borrow-logs')}
              className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
              title="รายการยืม-คืน"
            >
              <Users size={17} />
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
              title="ตั้งค่า"
            >
              <Settings size={17} />
            </button>
          </div>
        </div>

        {/* Modals */}
        <ScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onSuccess={() => {
            fetchBorrows();
            notifyBorrowUpdated();
          }}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={user}
        />
        <NotificationsModal
          isOpen={isNotiOpen}
          onClose={() => setIsNotiOpen(false)}
          activeCount={activeBorrowCount}
        />
      </div>
    </div>
  );
}
