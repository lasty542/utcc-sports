/**
 * หน้าแดชบอร์ดหลักของนักศึกษา แสดงคลังอุปกรณ์กีฬาแบบเรียลไทม์, ค้นหา, กรองหมวดหมู่ และเปิดฟอร์มขอยืม
 */
// src/pages/Student/Dashboard.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  QrCode,
  History,
  ArrowUpRight,
  Search,
  Settings,
  Trophy,
  Loader2,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardStyles as styles } from './Dashboard.styles';
import SettingsModal from '../../components/SettingsModal';
import BorrowModal from './components/BorrowModal';
import { formatEquipCode, listEquipment, type EquipmentItem } from '../../services/equipService';
import { getUserQuota, type UserQuotaResponse } from '../../services/borrowService';
import { subscribeBorrowUpdated } from '../../utils/realtime';

const SCENIC_MEADOW_BG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop';

const DEFAULT_IMAGES_BY_CATEGORY: Record<string, string> = {
  ฟุตบอล: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop',
  บาสเกตบอล: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop',
  วอลเลย์บอล: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop',
  แบดมินตัน: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop',
  เทเบิลเทนนิส: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?q=80&w=600&auto=format&fit=crop',
};
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop';

const BASE_CATEGORIES = ['ทั้งหมด', 'แบดมินตัน', 'บาสเกตบอล', 'ฟุตบอล', 'วอลเลย์บอล'];

const SPORT_BADGES = [
  { code: 'FB', label: 'ฟุตบอล', emoji: '⚽' },
  { code: 'BB', label: 'บาสเกตบอล', emoji: '🏀' },
  { code: 'VB', label: 'วอลเลย์บอล', emoji: '🏐' },
  { code: 'BD', label: 'แบดมินตัน', emoji: '🏸' },
];

interface StockIndicator {
  dotClass: string;
  badgeClass: string;
  barClass: string;
  label: string;
}

// กำหนดสีและข้อความสถานะสต็อกจากจำนวนอุปกรณ์คงเหลือ
function getStockIndicator(available: number): StockIndicator {
  if (available <= 0) {
    return {
      dotClass: 'bg-red-500',
      badgeClass: 'bg-red-500/90 text-white',
      barClass: 'bg-red-500',
      label: 'หมดชั่วคราว',
    };
  }
  if (available < 3) {
    return {
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-500/90 text-white',
      barClass: 'bg-amber-500',
      label: 'เหลือน้อย',
    };
  }
  return {
    dotClass: 'bg-emerald-400',
    badgeClass: 'bg-emerald-600/90 text-white',
    barClass: 'bg-emerald-500',
    label: 'พร้อมยืม',
  };
}

// เลือกรูปภาพอุปกรณ์จาก URL หรือใช้ภาพเริ่มต้นตามหมวดหมู่กีฬา
function resolveImage(item: EquipmentItem): string {
  if (item.image) return item.image;
  if (item.category && DEFAULT_IMAGES_BY_CATEGORY[item.category]) {
    return DEFAULT_IMAGES_BY_CATEGORY[item.category];
  }
  return FALLBACK_IMAGE;
}

// คอมโพเนนต์หน้าแดชบอร์ดนักศึกษา
export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquip, setSelectedEquip] = useState<EquipmentItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quota, setQuota] = useState<UserQuotaResponse | null>(null);

  // ดึงข้อมูลโควตาการยืมรายบุคคล
  const fetchQuota = useCallback(async () => {
    try {
      const q = await getUserQuota();
      setQuota(q);
    } catch {
      // ignore
    }
  }, []);

  // โหลดรายการอุปกรณ์ทั้งหมดจาก API ใหม่หลังมีการยืมหรือกดรีเฟรช
  const reloadEquipments = useCallback(async () => {
    try {
      setError(null);
      const data = await listEquipment();
      setEquipments(data);
      void fetchQuota();
    } catch (err) {
      const msg = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message || 'ไม่สามารถโหลดรายการอุปกรณ์ได้'
        : 'ไม่สามารถโหลดรายการอุปกรณ์ได้';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchQuota]);

  useEffect(() => {
    let active = true;
    listEquipment()
      .then((data) => {
        if (active) {
          setError(null);
          setEquipments(data);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = axios.isAxiosError<{ message?: string }>(err)
            ? err.response?.data?.message || 'ไม่สามารถโหลดรายการอุปกรณ์ได้'
            : 'ไม่สามารถโหลดรายการอุปกรณ์ได้';
          setError(msg);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    void fetchQuota();

    // เชื่อมต่อการแจ้งเตือน Real-time เมื่อสถานะโควตาหรือสต็อกเปลี่ยน
    const unsubscribe = subscribeBorrowUpdated(() => {
      void reloadEquipments();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchQuota, reloadEquipments]);

  // Real-time Auto-polling ทุกๆ 4 วินาที เพื่ออัปเดตจำนวนสต็อกคงเหลือและโควตาเมื่อมีคนยืมหรือคืน
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const [fresh, freshQuota] = await Promise.all([listEquipment(), getUserQuota()]);
        setEquipments(fresh);
        setQuota(freshQuota);
      } catch {
        // Silent fail during background polling
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  const categories = useMemo(() => {
    const dynamicCats = equipments
      .map((item) => item.category)
      .filter((cat): cat is string => Boolean(cat && cat.trim()));
    return Array.from(new Set([...BASE_CATEGORIES, ...dynamicCats]));
  }, [equipments]);

  const totalAvailableUnits = useMemo(
    () => equipments.reduce((sum, item) => sum + Math.max(0, item.available), 0),
    [equipments]
  );

  const filteredEquipments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return equipments.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ทั้งหมด' || (item.category || 'อื่นๆ') === selectedCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      const code = formatEquipCode(item.id).toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        code.includes(query) ||
        String(item.id).includes(query) ||
        (item.category || '').toLowerCase().includes(query)
      );
    });
  }, [equipments, selectedCategory, searchQuery]);

  return (
    <div
      className={styles.container}
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      <div className={styles.bgGlowOverlay} />

      <div className={styles.contentWrapper}>
        {/* ================= iPadOS TOP FLOATING BAR + DYNAMIC ISLAND ================= */}
        <motion.header
          className={styles.headerNavbar}
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Left: Avatar + Frosted Settings Pill */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl border-2 border-white shadow-lg flex items-center justify-center font-black text-emerald-900 text-sm">
              {user?.name ? user.name.charAt(0) : 'S'}
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className={styles.menuBtn}>
              <Settings size={14} /> Settings
            </button>
          </div>

          {/* Center: iPhone Dynamic Island Status Pill */}
          <button
            type="button"
            onClick={() => navigate('/student/qrcode')}
            className="hidden lg:flex items-center gap-3 bg-white/82 hover:bg-white/95 backdrop-blur-2xl backdrop-saturate-150 px-4 py-1.5 rounded-full shadow-[0_12px_32px_rgba(15,23,42,0.16)] border border-white/80 transition-all cursor-pointer"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
              <Sparkles size={13} />
            </span>
            <div className="text-left">
              <p className="text-[11px] font-black text-slate-900 leading-tight">
                UTCC Sport® Ready
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                พร้อมยืมทั้งหมด {totalAvailableUnits} ชิ้น
              </p>
            </div>
            <span className="ml-1 text-[10px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-full">
              QR Pass
            </span>
          </button>

          {/* Right: Segmented Glass Switcher + Student Pill */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white/25 backdrop-blur-2xl border border-white/40 p-1 rounded-full shadow-lg">
              <button
                type="button"
                onClick={() => navigate('/student')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-white text-slate-900 shadow-sm cursor-pointer"
              >
                Catalog
              </button>
              <button
                type="button"
                onClick={() => navigate('/student/qrcode')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-full text-white/90 hover:text-white cursor-pointer"
              >
                QR Pass
              </button>
              <button
                type="button"
                onClick={() => navigate('/student/history')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-full text-white/90 hover:text-white cursor-pointer"
              >
                History
              </button>
            </div>

            <div className={styles.userStatsPill}>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">ID</span>
              <span className="font-mono font-black text-emerald-900">
                {user?.studentId || '-'}
              </span>
            </div>
          </div>
        </motion.header>

        {/* User Borrowing Quota Status Bar */}
        <motion.div
          className="mb-5 bg-white/92 backdrop-blur-2xl rounded-3xl p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.1)] border border-white/80 flex flex-wrap items-center justify-between gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                quota?.hasOverdue
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : quota?.remainingItems === 0
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              }`}
            >
              {quota?.hasOverdue ? (
                <AlertTriangle size={20} />
              ) : quota?.remainingItems === 0 ? (
                <AlertCircle size={20} />
              ) : (
                <ShieldCheck size={20} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-slate-800">
                  โควตาการยืมคงเหลือ:
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    quota?.hasOverdue
                      ? 'bg-red-100 text-red-800'
                      : quota?.remainingItems === 0
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {quota?.remainingItems ?? 3} / 3 ชิ้น
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  (คำขอที่ใช้งาน {quota?.currentRequests ?? 0} / 2)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {quota?.hasOverdue
                  ? '⚠️ คุณมีรายการที่เลยกำหนดส่งคืนค้างอยู่ ระบบจะระงับการสร้างคำขอยืมใหม่จนกว่าจะคืนอุปกรณ์'
                  : quota?.remainingItems === 0
                  ? 'คุณใช้โควตาการยืมเต็มแล้ว (สูงสุด 3 ชิ้น) ต้องนำอุปกรณ์มาส่งคืนก่อนจึงจะยืมเพิ่มได้'
                  : 'นักศึกษา 1 คนสามารถยืมอุปกรณ์ได้สูงสุดไม่เกิน 3 ชิ้น และไม่เกิน 2 คำขอพร้อมกัน'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {quota?.hasOverdue ? (
              <button
                type="button"
                onClick={() => navigate('/student/history')}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm"
              >
                ดูรายการที่ต้องคืน
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/student/qrcode')}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <QrCode size={14} /> บัตรดิจิทัล
              </button>
            )}
          </div>
        </motion.div>

        {/* ================= EDITORIAL + FROSTED BENTO GRID ================= */}
        <div className={styles.bentoMainGrid}>
          {/* Left White Editorial Block (Dsgners style) */}
          <motion.div
            className="md:col-span-4 bg-white/88 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.16)] border border-white/85 flex flex-col justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                  UTCC SPORTS PLATFORM
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight mb-2">
                UTCC Sport<span className="text-emerald-600">®</span>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                เลือกหมวดหมู่กีฬาที่คุณต้องการ เพื่อตรวจสอบสต็อกแบบเรียลไทม์และรับ QR Pass ได้ทันที
              </p>

              {/* Circular Category Chips inspired by Ai / Ps / Ae / Fg */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {SPORT_BADGES.map((badge) => {
                  const active = selectedCategory === badge.label;
                  return (
                    <button
                      key={badge.code}
                      type="button"
                      onClick={() =>
                        setSelectedCategory(active ? 'ทั้งหมด' : badge.label)
                      }
                      title={badge.label}
                      className={`w-11 h-11 rounded-full border text-xs font-black flex flex-col items-center justify-center transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-md'
                          : 'bg-white/90 text-slate-800 border-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      <span className="text-sm leading-none">{badge.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-200/70 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                  {user?.name ? user.name.charAt(0) : 'S'}
                </div>
                <span className="text-xs font-bold text-slate-900 truncate">
                  {user?.name || 'นักศึกษา UTCC'}
                </span>
              </div>
              <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                ACTIVE
              </span>
            </div>
          </motion.div>

          {/* Center Warm Cream Editorial Hero Card */}
          <motion.div
            className={styles.heroCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="bg-slate-900 text-white text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase">
                  ONLINE SPORT GEAR
                </span>
                <span className="text-[11px] font-black text-slate-600 font-mono">
                  2026 EDITION
                </span>
              </div>
              <h2 className={styles.heroTitle}>SPORT GEAR</h2>
              <p className={styles.heroSubtitle}>
                ระบบยืม-คืนอุปกรณ์กีฬา มหาวิทยาลัยหอการค้าไทย กดที่การ์ดอุปกรณ์ด้านล่างเพื่อดูรายละเอียดในหน้าต่างโปร่งแสงและทำรายการยืมได้ทันที
              </p>
            </div>

            {/* Mini Editorial Catalog Preview Table */}
            <div className="mt-5 pt-4 border-t border-slate-900/10 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>LIVE INVENTORY SUMMARY</span>
                <span>STOCK</span>
              </div>
              {equipments.slice(0, 3).map((eq) => (
                <div
                  key={eq.id}
                  onClick={() => eq.available > 0 && setSelectedEquip(eq)}
                  className="flex items-center justify-between py-1 border-b border-slate-900/10 last:border-none cursor-pointer hover:text-emerald-800 transition-colors"
                >
                  <span className="font-bold truncate pr-2">{eq.name}</span>
                  <span className="font-mono font-black shrink-0">
                    {eq.available}/{eq.total}
                  </span>
                </div>
              ))}
              {equipments.length === 0 && !loading && (
                <p className="text-slate-600 text-xs">ยังไม่มีรายการอุปกรณ์ในระบบ</p>
              )}
            </div>
          </motion.div>

          {/* Right Column: Frosted Glass QR + Punchy Orange History + Quick Search */}
          <div className="md:col-span-3 flex flex-col gap-4">
            {/* Translucent Glass Tile: QR Pass */}
            <motion.div
              onClick={() => navigate('/student/qrcode')}
              className={styles.actionBoxGreen}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                    TOTP QR
                  </span>
                  <h3 className="text-base font-black mt-2 leading-tight">
                    แสดงบัตร QR Pass
                  </h3>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    รีเฟรชอัตโนมัติทุก 30 วินาที
                  </p>
                </div>
                <div className="bg-white/20 p-2.5 rounded-2xl">
                  <QrCode size={20} />
                </div>
              </div>
            </motion.div>

            {/* Vibrant Orange Tile: History (Dsgners style) */}
            <motion.div
              onClick={() => navigate('/student/history')}
              className={styles.actionBoxLight}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/15 px-2.5 py-0.5 rounded-full">
                    BORROW LOGS
                  </span>
                  <h3 className="text-base font-black mt-2 leading-tight">
                    ประวัติการยืม-คืน
                  </h3>
                  <p className="text-[11px] text-white/85 mt-0.5">
                    เช็กวันกำหนดคืน & ดู QR ซ้ำ
                  </p>
                </div>
                <ArrowUpRight size={24} className="shrink-0" />
              </div>
            </motion.div>

            {/* Frosted Search Pill */}
            <div className={styles.searchBoxCard}>
              <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-1.5 block">
                QUICK SEARCH
              </span>
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="ชื่ออุปกรณ์ หรือ EQ-0001..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= คลังอุปกรณ์กีฬา (FROSTED GLASS CATALOG) ================= */}
        <div className={styles.sectionHeader}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className={styles.sectionTitle}>
              <Trophy className="text-amber-300" size={20} />
              คลังอุปกรณ์กีฬาคงเหลือเรียลไทม์ (Equipment Catalog)
            </h2>
            <span className="text-xs font-bold bg-white/25 text-white px-3 py-1 rounded-full w-fit border border-white/30">
              แสดง {filteredEquipments.length} จาก {equipments.length} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/35 border border-white/25'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ================= Equipment Grid Cards ================= */}
        {loading ? (
          <div className="bg-white/30 backdrop-blur-2xl rounded-[2.2rem] p-12 text-center text-white border border-white/40 shadow-xl">
            <Loader2 size={32} className="animate-spin text-white mx-auto mb-2" />
            <p className="text-xs font-bold">กำลังโหลดรายการอุปกรณ์กีฬา...</p>
          </div>
        ) : error ? (
          <div className="bg-white/35 backdrop-blur-2xl rounded-[2.2rem] p-12 text-center text-slate-900 border border-white/50 shadow-xl">
            <AlertCircle size={32} className="text-red-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-red-700 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void reloadEquipments();
              }}
              className="bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} /> โหลดข้อมูลใหม่
            </button>
          </div>
        ) : filteredEquipments.length === 0 ? (
          <div className="bg-white/25 backdrop-blur-2xl rounded-[2.2rem] p-12 text-center text-white border border-white/40 shadow-xl">
            <Trophy size={36} className="mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold">ไม่พบอุปกรณ์ที่ตรงกับการค้นหาหรือหมวดหมู่ที่เลือก</p>
          </div>
        ) : (
          <div className={styles.equipmentGrid}>
            {filteredEquipments.map((item, index) => {
              const total = Math.max(1, item.total);
              const available = Math.max(0, item.available);
              const percent = Math.min(100, Math.round((available / total) * 100));
              const stock = getStockIndicator(available);
              const equipCode = formatEquipCode(item.id);

              return (
                <motion.div
                  key={item.id}
                  onClick={() => available > 0 && setSelectedEquip(item)}
                  className={styles.equipmentCard}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
                >
                  <div className={styles.equipmentImageWrapper}>
                    <div className="w-full flex items-center justify-between gap-2 mb-3 z-20">
                      <span className="font-mono text-[10px] font-black tracking-wider bg-slate-900/85 text-white px-2.5 py-1 rounded-full">
                        {equipCode}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap ${stock.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${stock.dotClass}`} />
                        คงเหลือ {available} / {item.total} ชิ้น
                      </span>
                    </div>

                    <div className="w-full h-36 relative flex items-center justify-center z-10 overflow-hidden rounded-[1.4rem] bg-slate-100 border border-white/70 shadow-inner">
                      <img
                        src={resolveImage(item)}
                        alt={item.name}
                        className={`w-full h-full object-cover transform transition-transform duration-300 hover:scale-105 ${
                          available <= 0 ? 'grayscale opacity-55' : ''
                        }`}
                      />
                    </div>

                    <h3 className="text-sm sm:text-base font-black text-slate-900 text-center mt-3.5 leading-snug w-full min-h-[40px] flex items-center justify-center px-1 z-10">
                      {item.name}
                    </h3>

                    <div className="w-full mt-2.5 space-y-2 z-10">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="bg-white/90 text-slate-800 border border-slate-200 font-black px-2.5 py-0.5 rounded-full uppercase">
                          {item.category || 'อื่นๆ'}
                        </span>
                        <span className="font-bold text-slate-600">{stock.label}</span>
                      </div>

                      <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${stock.barClass}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.equipmentContent}>
                    <button
                      type="button"
                      disabled={available <= 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEquip(item);
                      }}
                      className={`w-full font-bold py-3 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 text-xs ${
                        available <= 0
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-emerald-700 text-white cursor-pointer'
                      }`}
                    >
                      {available <= 0 ? (
                        'อุปกรณ์หมดชั่วคราว'
                      ) : (
                        <>
                          กดดู / ยืมอุปกรณ์ <ArrowUpRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= BOTTOM FLOATING iPadOS GLASS DOCK ================= */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-2 bg-white/30 backdrop-blur-2xl backdrop-saturate-150 px-3 py-2 rounded-full border border-white/50 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform"
            title="Catalog"
          >
            <LayoutGrid size={17} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/student/qrcode')}
            className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
            title="QR Pass"
          >
            <QrCode size={17} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/student/history')}
            className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
            title="History"
          >
            <History size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-full bg-white/35 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
            title="Settings"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Frosted Glass Borrow Modal */}
      <BorrowModal
        equipment={selectedEquip}
        onClose={() => setSelectedEquip(null)}
        onSuccess={() => void reloadEquipments()}
      />

      {/* Frosted Glass Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={user}
        onLogout={() => navigate('/')}
      />
    </div>
  );
}
