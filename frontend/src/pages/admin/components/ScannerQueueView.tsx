import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';

interface ScannerQueueViewProps {
  activeQueue: BorrowItem[];
  isSubmitting: boolean;
  scanCode: string;
  setScanCode: (val: string) => void;
  onQuickAction: (borrowId: number) => void;
  onManualSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export default function ScannerQueueView({
  activeQueue,
  isSubmitting,
  scanCode,
  setScanCode,
  onQuickAction,
  onManualSubmit,
  onClose,
}: ScannerQueueViewProps) {
  return (
    <div className="space-y-4">
      {/* รายการคิวที่คลิกอนุมัติ/รับคืนได้ทันที */}
      {activeQueue.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-950 mb-2">
            รายการที่รอรับของ / กำลังยืม (คลิกเพื่อยืนยันทันที)
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeQueue.map((item) => {
              const isPending = item.statusType === 'pending';
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onQuickAction(item.id)}
                  className="w-full text-left bg-white/85 hover:bg-emerald-50 border border-white rounded-2xl p-3 shadow-sm transition-all flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">
                      REQ-{String(item.id).padStart(4, '0')} • {item.equipment} ({item.qty})
                    </p>
                    {item.itemCodes && item.itemCodes.length > 0 && (
                      <p className="font-mono text-[10px] font-bold text-emerald-800 truncate">
                        รหัสชิ้น: {item.itemCodes.join(', ')}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 truncate">
                      {item.userName} ({item.studentId})
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-black text-white ${
                      isPending ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}
                  >
                    {isPending ? 'ยืนยันรับของ' : 'รับคืน'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={onManualSubmit} className="pt-2 border-t border-gray-200/70">
        <label className="block text-xs font-bold text-gray-700 mb-1">
          หรือกรอกรหัสนักศึกษา / รหัสคำขอ (Token)
        </label>
        <input
          type="text"
          placeholder="เช่น 2410511101055, REQ-0001 หรือ UTCC-PASS:..."
          value={scanCode}
          onChange={(e) => setScanCode(e.target.value)}
          disabled={isSubmitting}
          className="w-full bg-white/85 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 mb-3 outline-none"
          required
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            ยืนยันรับ / คืนอุปกรณ์
          </button>
        </div>
      </form>
    </div>
  );
}
