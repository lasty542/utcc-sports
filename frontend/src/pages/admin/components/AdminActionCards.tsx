/**
 * กล่องการ์ดเครื่องมือหลักบนแดชบอร์ดผู้ดูแล (Scan QR, Inventory, Borrow Logs)
 * โทนสีเขียวพรีเมียม Deep Forest Green ขนาดสมส่วนพอดีทุกขนาดหน้าจอ
 */
import { motion } from 'framer-motion';
import { QrCode, Package, Users, ArrowUpRight } from 'lucide-react';

interface AdminActionCardsProps {
  onOpenScanner: () => void;
  onNavigate: (path: string) => void;
}

export default function AdminActionCards({ onOpenScanner, onNavigate }: AdminActionCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 mb-5 sm:mb-6">
      {/* Card 1: Scan QR */}
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border border-white/80 flex flex-col justify-between"
      >
        <div>
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md inline-block mb-2.5">
            <QrCode size={20} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1">สแกน QR Code นักศึกษา</h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            เปิดกล้องสแกนรหัสเพื่อบันทึกการรับหรือคืนอุปกรณ์กีฬาหน้าเคาน์เตอร์
          </p>
        </div>
        <button
          onClick={onOpenScanner}
          className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          เริ่มสแกนเลย <ArrowUpRight size={14} />
        </button>
      </motion.div>

      {/* Card 2: Inventory */}
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-[#0b2a1c]/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border border-emerald-500/30 text-white flex flex-col justify-between"
      >
        <div>
          <div className="bg-emerald-500/20 text-emerald-300 p-2.5 rounded-xl inline-block mb-2.5 border border-emerald-500/30">
            <Package size={20} />
          </div>
          <h3 className="text-base sm:text-lg font-black mb-1 drop-shadow-sm">จัดการคลังอุปกรณ์</h3>
          <p className="text-xs text-emerald-100/80 mb-4 leading-relaxed">
            เพิ่ม ลด หรือแก้ไขจำนวนและสถานะอุปกรณ์กีฬาทั้งหมดในระบบ
          </p>
        </div>
        <button
          onClick={() => onNavigate('/admin/inventory')}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          จัดการคลัง <ArrowUpRight size={14} />
        </button>
      </motion.div>

      {/* Card 3: Borrow Logs */}
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-[#0d3322]/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border border-emerald-500/40 text-white flex flex-col justify-between sm:col-span-2 lg:col-span-1"
      >
        <div>
          <div className="bg-emerald-500/25 text-emerald-300 p-2.5 rounded-xl inline-block mb-2.5 border border-emerald-500/30">
            <Users size={20} />
          </div>
          <h3 className="text-base sm:text-lg font-black mb-1">ตรวจสอบสถานะการยืม</h3>
          <p className="text-xs text-emerald-100/80 mb-4 leading-relaxed">
            ดูรายชื่อนักศึกษาที่ยังไม่คืนอุปกรณ์ หรือรายการที่เกินกำหนด
          </p>
        </div>
        <button
          onClick={() => onNavigate('/admin/borrow-logs')}
          className="w-full bg-white text-slate-900 hover:bg-emerald-50 font-bold py-2.5 px-3.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          ดูรายการผู้ยืม <ArrowUpRight size={14} />
        </button>
      </motion.div>
    </div>
  );
}
