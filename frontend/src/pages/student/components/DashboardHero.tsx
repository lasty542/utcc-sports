/**
 * ส่วนหัวและแผงควบคุมหลักของแดชบอร์ดนักศึกษา (Hero, Quota Card และ Quick Actions)
 * จัดสัดส่วนให้พอดีและตอบสนองทุกขนาดหน้าจอ (Mobile, iPad, Laptop, PC)
 */
import { motion } from 'framer-motion';
import { ArrowUpRight, QrCode, Search, Sparkles } from 'lucide-react';
import type { User } from '../../../services/authService';
import type { EquipmentItem } from '../../../services/equipService';
import type { UserQuotaResponse } from '../../../services/borrowService';

interface DashboardHeroProps {
  user: User | null;
  quota: UserQuotaResponse | null;
  activeCount: number;
  equipments: EquipmentItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate: (path: string) => void;
  onSelectEquip: (item: EquipmentItem) => void;
}

export default function DashboardHero({
  user,
  quota,
  activeCount,
  equipments,
  loading,
  searchQuery,
  onSearchChange,
  onNavigate,
  onSelectEquip,
}: DashboardHeroProps) {
  const currentItems = quota?.currentItems ?? activeCount;
  const maxItems = quota?.maxItems ?? 3;
  const remaining = quota?.remainingItems ?? Math.max(0, 3 - currentItems);
  const remainingReqs = quota?.remainingRequests ?? 3;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 mb-5 sm:mb-6">
      {/* Editorial Cream Hero Card (ซ้าย/หลัก ตาม Image 3) */}
      <motion.div
        className="md:col-span-7 lg:col-span-6 bg-[#f5eedb] text-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 shadow-xl border border-white/60 flex flex-col justify-between relative overflow-hidden"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="bg-slate-900 text-white text-[9px] sm:text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase">
              ONLINE SPORT PLATFORM
            </span>
            <span className="text-[10px] sm:text-[11px] font-black text-slate-600 font-mono">
              2026 EDITION
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-950 uppercase leading-none mb-1.5">
            SPORT GEAR
          </h1>
          <p className="text-slate-700 text-xs sm:text-sm leading-relaxed font-medium max-w-lg">
            ระบบยืม-คืนอุปกรณ์กีฬา มหาวิทยาลัยหอการค้าไทย ตรวจสอบสต็อกเรียลไทม์ และสแกนรับของได้ทันที
          </p>

          {/* Live Mini Preview Bar */}
          <div className="mt-3.5 pt-3 border-t border-slate-900/10 hidden sm:block">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
              <span>STOCK PREVIEW</span>
              <span>AVAILABLE</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {equipments.slice(0, 3).map((eq) => (
                <div
                  key={eq.id}
                  onClick={() => eq.available > 0 && onSelectEquip(eq)}
                  className="bg-white/60 hover:bg-white px-2 py-1 rounded-lg border border-slate-900/10 cursor-pointer transition-colors"
                >
                  <p className="font-bold truncate text-[11px] text-slate-900">{eq.name}</p>
                  <p className="font-mono text-[10px] font-black text-emerald-700">
                    {eq.available}/{eq.total} ชิ้น
                  </p>
                </div>
              ))}
              {equipments.length === 0 && !loading && (
                <p className="text-slate-500 text-[11px] col-span-3">ยังไม่มีอุปกรณ์ในระบบ</p>
              )}
            </div>
          </div>
        </div>

        {/* User Quota Footer Strip */}
        <div className="mt-4 pt-3 border-t border-slate-900/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-slate-900 truncate">
              {user?.name || 'นักศึกษา มหาวิทยาลัยหอการค้าไทย'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black bg-emerald-800 text-white px-2.5 py-0.5 rounded-full shadow-xs">
              โควตา: {currentItems}/{maxItems} ชิ้น
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-white/70 px-2 py-0.5 rounded-full border border-slate-300">
              ยืมได้อีก {remaining} ชิ้น (เหลือ {remainingReqs} คำขอ)
            </span>
          </div>
        </div>
      </motion.div>

      {/* Middle Column: 2 Quick Action Buttons (side-by-side on mobile, stacked on desktop) */}
      <div className="md:col-span-5 lg:col-span-3 grid grid-cols-2 md:grid-cols-1 gap-2.5 sm:gap-3">
        {/* TOTP QR Pass Card */}
        <motion.div
          onClick={() => onNavigate('/student/qrcode')}
          className="bg-[#0d2f1f] hover:bg-[#113a27] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-lg border border-emerald-500/30 cursor-pointer transition-all text-white flex flex-col justify-between"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                TOTP QR
              </span>
              <h3 className="text-sm sm:text-base font-black mt-1.5 leading-tight">
                แสดงคิวอาร์โค้ด
              </h3>
              <p className="text-[10px] text-emerald-200/80 mt-0.5 hidden sm:block">
                สแกนรับ-คืนอุปกรณ์ที่เคาน์เตอร์
              </p>
            </div>
            <div className="bg-white/15 p-2 rounded-xl shrink-0">
              <QrCode size={18} />
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-300 mt-2 inline-flex items-center gap-1">
            เปิดบัตรดิจิทัล <ArrowUpRight size={12} />
          </span>
        </motion.div>

        {/* Borrow Logs Card */}
        <motion.div
          onClick={() => onNavigate('/student/history')}
          className="bg-[#edf4ee] hover:bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-lg border border-white/80 cursor-pointer transition-all text-slate-900 flex flex-col justify-between"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded-full">
                LOGS
              </span>
              <h3 className="text-sm sm:text-base font-black mt-1.5 leading-tight">
                ประวัติการยืม-คืน
              </h3>
              <p className="text-[10px] text-slate-600 mt-0.5 hidden sm:block">
                ตรวจสอบสถานะและวันส่งคืน
              </p>
            </div>
            <div className="bg-black/10 p-2 rounded-xl shrink-0">
              <Sparkles size={18} className="text-emerald-700" />
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-800 mt-2 inline-flex items-center gap-1">
            ดูรายการยืม <ArrowUpRight size={12} />
          </span>
        </motion.div>
      </div>

      {/* Right Column: Quick Search Box & Banner (Responsive for Tablet/Laptop/PC) */}
      <div className="col-span-1 md:col-span-12 lg:col-span-3 flex flex-col gap-2.5 sm:gap-3">
        {/* Quick Search */}
        <div className="bg-[#0b2b1d]/90 rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 shadow-lg border border-emerald-500/30 text-white">
          <span className="text-[9px] font-black text-emerald-300/80 tracking-wider uppercase mb-1.5 block">
            QUICK SEARCH
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-emerald-400/60" size={14} />
            <input
              type="text"
              placeholder="ค้นหาชื่ออุปกรณ์ หรือ EQ-0001..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-black/30 border border-emerald-500/30 rounded-xl text-xs font-bold text-white placeholder:text-emerald-300/40 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Mini Arena Banner matching PDF Image 3 */}
        <div className="relative h-20 sm:h-24 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-emerald-500/30 group hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800&auto=format&fit=crop"
            alt="UTCC Sport Arena"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex flex-col justify-end">
            <span className="text-[9px] font-black uppercase text-emerald-300 tracking-wider">
              FEATURED IN
            </span>
            <p className="text-xs font-black text-white leading-tight">UTCC SPORT ARENA COLLECTION</p>
          </div>
        </div>
      </div>
    </div>
  );
}
