/**
 * หน้าต่างแสดงสรุปการแจ้งเตือนระบบและจำนวนรายการยืมที่กำลังใช้งานอยู่สำหรับเจ้าหน้าที่
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCount: number;
}

// คอมโพเนนต์ Modal แสดงการแจ้งเตือนสถานะระบบและรายการยืมคงค้าง
export default function NotificationsModal({ isOpen, onClose, activeCount }: NotificationsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            className="bg-white/72 backdrop-blur-3xl backdrop-saturate-150 rounded-[2.2rem] p-6 max-w-sm w-full shadow-[0_28px_70px_rgba(15,23,42,0.28)] border border-white/80 ring-1 ring-white/50 relative"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer">
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-amber-100 text-amber-800 p-2.5 rounded-xl">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-emerald-950">การแจ้งเตือนระบบ</h2>
                <p className="text-[11px] text-gray-500">แจ้งเตือนสถานะการยืม-คืนอุปกรณ์</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-5">
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2.5 text-xs">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">มีรายการยืมที่ยังไม่ได้คืน</p>
                  <p className="text-amber-700/80 text-[10px] mt-0.5">ปัจจุบันมี {activeCount} รายการที่กำลังใช้งานอยู่</p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-2.5 text-xs">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900">ระบบคลังอุปกรณ์ออนไลน์</p>
                  <p className="text-emerald-700/80 text-[10px] mt-0.5">ข้อมูลสต็อกเชื่อมโยงกับหน้านักศึกษาเรียบร้อย</p>
                </div>
              </div>
            </div>

            <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
              รับทราบ
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}