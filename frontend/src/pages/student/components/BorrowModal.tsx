/**
 * หน้าต่างแบบ Pop-up โมดอลสำหรับเลือกวัน เวลา จำนวน และส่งคำขอยืมอุปกรณ์กีฬา
 */
import { motion, AnimatePresence } from 'framer-motion';
import type { EquipmentItem } from '../../../services/equipService';
import BorrowFormContent from './BorrowFormContent';

export interface BorrowModalProps {
  equipment: EquipmentItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BorrowModal({ equipment, onClose, onSuccess }: BorrowModalProps) {
  if (!equipment) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white/95 backdrop-blur-3xl rounded-[2.2rem] p-5 sm:p-6 w-full max-w-lg shadow-[0_25px_60px_rgba(15,23,42,0.25)] border border-white/80 my-auto"
        >
          <BorrowFormContent equipment={equipment} onClose={onClose} onSuccess={onSuccess} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
