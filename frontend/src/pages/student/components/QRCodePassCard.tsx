/**
 * การ์ดแสดงรายละเอียดคำขอและรหัสประจำชิ้นในหน้า QRCode
 */
import {
  Hash,
  Copy,
  CheckCircle2,
  UserCheck,
  Package,
  CalendarClock,
  Sparkles,
} from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';

interface QRCodePassCardProps {
  activeBorrow: BorrowItem | null;
  studentId: string;
  userName?: string;
  copiedKey: 'student' | 'request' | null;
  onCopy: (value: string, key: 'student' | 'request') => void;
  formatRequestCode: (id: number) => string;
  formatThaiDate: (isoDate: string) => string;
  extractReturnSlotLabel: (purpose: string | null) => string;
}

export default function QRCodePassCard({
  activeBorrow,
  studentId,
  userName,
  copiedKey,
  onCopy,
  formatRequestCode,
  formatThaiDate,
  extractReturnSlotLabel,
}: QRCodePassCardProps) {
  return (
    <div className="p-6 sm:p-8 bg-gray-50/70 text-left space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-[11px] font-bold mb-1">
            <span className="inline-flex items-center gap-1">
              <Hash size={12} className="text-emerald-600" /> รหัสคำขอยืม
            </span>
            {activeBorrow && (
              <button
                type="button"
                onClick={() => onCopy(formatRequestCode(activeBorrow.id), 'request')}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                title="คัดลอกรหัสคำขอ"
              >
                {copiedKey === 'request' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              </button>
            )}
          </div>
          <p className="font-mono font-black text-sm text-emerald-950">
            {activeBorrow ? formatRequestCode(activeBorrow.id) : 'ไม่มีรายการที่รอรับ/กำลังยืม'}
          </p>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-[11px] font-bold mb-1">
            <span className="inline-flex items-center gap-1">
              <UserCheck size={12} className="text-emerald-600" /> ผู้ยืม / รหัสนักศึกษา
            </span>
            <button
              type="button"
              onClick={() => onCopy(studentId, 'student')}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              title="คัดลอกรหัสนักศึกษา"
            >
              {copiedKey === 'student' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <p className="font-bold text-gray-900 truncate">{userName || 'นักศึกษา'}</p>
          <p className="font-mono text-[11px] text-gray-500">{studentId}</p>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
          <p className="text-gray-500 text-[11px] font-bold mb-1 inline-flex items-center gap-1">
            <Package size={12} className="text-emerald-600" /> รายการอุปกรณ์และจำนวน
          </p>
          {activeBorrow ? (
            <p className="font-bold text-emerald-950">
              {activeBorrow.equipment}{' '}
              <span className="text-emerald-700 font-black">({activeBorrow.qty} ชิ้น)</span>
            </p>
          ) : (
            <p className="text-gray-400 font-medium">ยังไม่มีรายการยืมที่รอรับ-คืน</p>
          )}
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
          <p className="text-gray-500 text-[11px] font-bold mb-1 inline-flex items-center gap-1">
            <CalendarClock size={12} className="text-amber-600" /> วันเวลาที่ต้องส่งคืน
          </p>
          {activeBorrow ? (
            <div>
              <p className="font-black text-amber-700">{formatThaiDate(activeBorrow.dueDate)}</p>
              <p className="text-[11px] text-gray-500">
                {extractReturnSlotLabel(activeBorrow.purpose)}
              </p>
            </div>
          ) : (
            <p className="text-gray-400 font-medium">-</p>
          )}
        </div>
      </div>

      {/* Assigned Asset / Serial Codes */}
      {activeBorrow && activeBorrow.itemCodes && activeBorrow.itemCodes.length > 0 && (
        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-900 inline-flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-600" /> รหัสประจำชิ้นที่ได้รับ (Asset Serials)
            </span>
            <span className="text-[10px] font-mono font-black text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">
              {activeBorrow.itemCodes.length} ชิ้น
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activeBorrow.itemCodes.map((code) => (
              <span
                key={code}
                className="font-mono text-xs font-black bg-white border border-emerald-300 text-emerald-950 px-2.5 py-1 rounded-xl shadow-2xs"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
