/**
 * ตารางแสดงรายการประวัติการยืม-คืนอุปกรณ์และปุ่มจัดการสำหรับเจ้าหน้าที่ (พร้อมลำดับคิวและปุ่มสแกน QR รายแถว)
 */
import { useMemo } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Trash2,
  Loader2,
  Clock,
  AlertTriangle,
  QrCode,
  Layers,
} from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';

interface BorrowLogsTableProps {
  logs: BorrowItem[];
  processingId: number | null;
  onConfirmPickup: (id: number) => void;
  onReturn: (id: number) => void;
  onDelete: (id: number) => void;
  onOpenScanner: (item?: BorrowItem) => void;
}

export default function BorrowLogsTable({
  logs,
  processingId,
  onConfirmPickup,
  onReturn,
  onDelete,
  onOpenScanner,
}: BorrowLogsTableProps) {
  // คำนวณลำดับคิวสำหรับรายการที่รอรับอุปกรณ์
  const pendingQueueIds = useMemo(() => {
    return logs
      .filter((i) => i.statusType === 'pending' || (i.statusType as string) === 'approved')
      .map((i) => i.id);
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Clock size={44} className="mx-auto mb-3 opacity-40 text-emerald-600" />
        <p className="text-sm font-bold text-slate-700">ไม่มีรายการที่ตรงกับเงื่อนไข</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[840px]">
        <thead>
          <tr className="border-b border-gray-200/80 text-[10px] sm:text-[11px] font-black text-emerald-950 uppercase tracking-wider bg-emerald-50/40">
            <th className="py-2.5 px-2.5 text-center">คิว</th>
            <th className="py-2.5 px-3">รหัส</th>
            <th className="py-2.5 px-3">ผู้ยืม / รหัส</th>
            <th className="py-2.5 px-3">อุปกรณ์</th>
            <th className="py-2.5 px-2.5 text-center">จำนวน</th>
            <th className="py-2.5 px-3">วันที่ยืม - กำหนดคืน</th>
            <th className="py-2.5 px-2.5 text-center">สถานะ</th>
            <th className="py-2.5 px-3 text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-800">
          {logs.map((item) => {
            const isPending = item.statusType === 'pending' || (item.statusType as string) === 'approved';
            const isReturned = item.statusType === 'returned';
            const isOverdue = item.statusType === 'overdue';
            const isBusy = processingId === item.id;

            // ค้นหาลำดับคิว
            const queueIdx = pendingQueueIds.indexOf(item.id);
            const queueNumber = queueIdx !== -1 ? queueIdx + 1 : null;

            return (
              <tr key={item.id} className="hover:bg-emerald-50/60 transition-colors">
                {/* ลำดับคิว */}
                <td className="py-2.5 px-2.5 text-center">
                  {queueNumber !== null ? (
                    <span className="inline-flex items-center gap-1 font-black text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                      <Layers size={10} /> คิว #{queueNumber}
                    </span>
                  ) : isReturned ? (
                    <span className="text-[10px] text-gray-400 font-bold">-</span>
                  ) : (
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                      กำลังยืม
                    </span>
                  )}
                </td>

                {/* รหัสคำขอ */}
                <td className="py-2.5 px-3 font-mono font-bold text-emerald-950 text-xs">
                  REQ-{String(item.id).padStart(4, '0')}
                </td>

                {/* ผู้ยืม / รหัส */}
                <td className="py-2.5 px-3">
                  <p className="font-bold text-slate-900 leading-tight text-xs">{item.userName}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.studentId}</p>
                </td>

                {/* อุปกรณ์ & รหัสประจำชิ้น */}
                <td className="py-2.5 px-3">
                  <p className="font-bold text-emerald-950 leading-tight text-xs">{item.equipment}</p>
                  {item.itemCodes && item.itemCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.itemCodes.map((code) => (
                        <span
                          key={code}
                          className="font-mono text-[9px] font-black bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded border border-emerald-300"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.purpose && (
                    <p className="text-[9px] text-gray-400 truncate max-w-[180px] mt-0.5">
                      {item.purpose}
                    </p>
                  )}
                </td>

                {/* จำนวน */}
                <td className="py-2.5 px-2.5 text-center">
                  <span className="font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200 text-xs">
                    {item.qty} ชิ้น
                  </span>
                </td>

                {/* วันที่ยืม - กำหนดคืน */}
                <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap text-xs">
                  <p className="text-[10px] sm:text-[11px]">{item.borrowDate || '-'}</p>
                  <p className={isOverdue ? 'text-red-600 font-bold flex items-center gap-1 text-[10px] sm:text-[11px]' : 'text-gray-500 text-[10px] sm:text-[11px]'}>
                    {isOverdue && <AlertTriangle size={11} />} ถึง {item.dueDate || '-'}
                  </p>
                </td>

                {/* สถานะ */}
                <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black shadow-xs ${
                      isReturned
                        ? 'bg-gray-100 text-gray-600 border border-gray-200'
                        : isOverdue
                        ? 'bg-red-500 text-white'
                        : isPending
                        ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>

                {/* จัดการ (อนุมัติ / คืน / สแกน QR / ลบ) */}
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => onConfirmPickup(item.id)}
                        disabled={isBusy}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                        title="อนุมัติรับอุปกรณ์"
                      >
                        {isBusy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        อนุมัติรับ
                      </button>
                    )}

                    {!isReturned && !isPending && (
                      <button
                        type="button"
                        onClick={() => onReturn(item.id)}
                        disabled={isBusy}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                        title="บันทึกการส่งคืนอุปกรณ์"
                      >
                        {isBusy ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                        รับคืน
                      </button>
                    )}

                    {!isReturned && (
                      <button
                        type="button"
                        onClick={() => onOpenScanner(item)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                        title="เปิดกล้องสแกน QR เพื่อยืนยันรายการนี้"
                      >
                        <QrCode size={11} />
                        สแกน QR
                      </button>
                    )}

                    {isReturned && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                        คืนแล้ว
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      disabled={isBusy}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      title="ลบรายการ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
