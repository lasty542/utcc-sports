/**
 * คอมโพเนนต์ตารางแสดงความเคลื่อนไหวการยืม-คืนล่าสุดบนหน้าแดชบอร์ดเจ้าหน้าที่
 * กล่องสีขาวสว่าง คมชัด สวยงามเหมือนหน้า Inventory (Image 3)
 */
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';

export default function RecentLogsTable({ logs }: { logs: BorrowItem[] }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-gray-200/90 text-slate-900">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">ความเคลื่อนไหวล่าสุด</h3>
            <p className="text-xs text-slate-600 font-medium mt-0.5">ประวัติการขอเบิกและคืนอุปกรณ์กีฬาล่าสุดในระบบ</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/admin/borrow-logs')}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
        >
          ดูทั้งหมด <ArrowRight size={13} />
        </button>
      </div>

      {logs.length > 0 ? (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left text-xs min-w-[420px]">
            <thead>
              <tr className="border-b border-gray-200 text-slate-700 bg-slate-50 text-[11px] font-black uppercase tracking-wider">
                <th className="py-2.5 px-3">อุปกรณ์</th>
                <th className="py-2.5 px-3">ผู้ยืม / รหัส</th>
                <th className="py-2.5 px-3">วันที่ทำรายการ</th>
                <th className="py-2.5 px-3 text-right">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {logs.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{item.equipment}</td>
                  <td className="py-3 px-3 text-slate-700">{item.userName} <span className="text-slate-500 font-mono text-[11px]">({item.studentId})</span></td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{item.borrowDate}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.statusType === 'pending' ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                      : item.statusType === 'borrowing' ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : item.statusType === 'overdue' ? 'bg-red-100 text-red-900 border border-red-200'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-slate-400 text-xs">
          ยังไม่มีข้อมูลการทำรายการยืม-คืนในระบบ
        </div>
      )}
    </div>
  );
}
