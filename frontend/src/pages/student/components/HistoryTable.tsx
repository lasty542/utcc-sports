import { Calendar, CheckCircle2, Clock, AlertCircle, QrCode, Hourglass } from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';
import { historyStyles as styles } from '../History.styles';
import { formatRequestCode, formatThaiDate, getNormalizedStatus } from './historyUtils';

interface HistoryTableProps {
  items: BorrowItem[];
  onOpenQrPass: (item: BorrowItem) => void;
}

export default function HistoryTable({ items, onOpenQrPass }: HistoryTableProps) {
  return (
    <div className={styles.tableWrapper}>
      <table className={`${styles.table} min-w-[700px]`}>
        <thead>
          <tr>
            <th className={styles.th}>รหัสคำขอ</th>
            <th className={styles.th}>ชื่ออุปกรณ์</th>
            <th className={`${styles.th} text-center`}>จำนวน</th>
            <th className={styles.th}>วันที่ยืม</th>
            <th className={styles.th}>กำหนดส่งคืน</th>
            <th className={`${styles.th} text-center`}>สถานะ</th>
            <th className={`${styles.th} text-center`}>QR Pass</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const statusKey = getNormalizedStatus(item);
            const canViewQr = statusKey !== 'returned';

            return (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className={`${styles.td} font-mono font-bold text-emerald-950`}>
                  {formatRequestCode(item.id)}
                </td>
                <td className={styles.td}>
                  <p className="font-bold text-slate-900 leading-snug">{item.equipment}</p>
                  {item.itemCodes && item.itemCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.itemCodes.map((code) => (
                        <span
                          key={code}
                          className="font-mono text-[9px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.purpose && (
                    <p className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">
                      {item.purpose}
                    </p>
                  )}
                </td>
                <td className={`${styles.td} text-center font-bold text-slate-900`}>{item.qty} ชิ้น</td>
                <td className={styles.td}>
                  <span className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                    <Calendar size={13} className="text-emerald-600" />
                    {formatThaiDate(item.borrowDate)}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                    <Calendar size={13} className="text-amber-600" />
                    {formatThaiDate(item.dueDate)}
                  </span>
                </td>
                <td className={`${styles.td} text-center whitespace-nowrap`}>
                  {statusKey === 'borrowing' && (
                    <span className={styles.badgeBorrowing}>
                      <Clock size={11} className="inline mr-1" /> {item.status}
                    </span>
                  )}
                  {statusKey === 'pending' && (
                    <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block shadow-xs">
                      <Hourglass size={11} className="inline mr-1" /> {item.status}
                    </span>
                  )}
                  {statusKey === 'returned' && (
                    <span className={styles.badgeReturned}>
                      <CheckCircle2 size={11} className="inline mr-1" /> {item.status}
                    </span>
                  )}
                  {statusKey === 'overdue' && (
                    <span className={styles.badgeOverdue}>
                      <AlertCircle size={11} className="inline mr-1" /> {item.status}
                    </span>
                  )}
                </td>
                <td className={`${styles.td} text-center whitespace-nowrap`}>
                  {canViewQr ? (
                    <button
                      type="button"
                      onClick={() => onOpenQrPass(item)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode size={12} /> ดู QR
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
