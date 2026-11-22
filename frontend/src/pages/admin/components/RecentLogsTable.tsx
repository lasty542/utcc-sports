/**
 * คอมโพเนนต์ตารางแสดงความเคลื่อนไหวการยืม-คืนล่าสุดบนหน้าแดชบอร์ดเจ้าหน้าที่
 */
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';

// แสดงรายการประวัติการยืม-คืนล่าสุดพร้อมลิงก์ไปยังหน้าตรวจสอบทั้งหมด
export default function RecentLogsTable({ logs }: { logs: BorrowItem[] }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white/78 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] p-5 sm:p-6 shadow-[0_18px_42px_rgba(15,23,42,0.14)] border border-white/80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-100 text-emerald-800 p-2 rounded-lg">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-emerald-950 leading-tight">ความเคลื่อนไหวล่าสุด</h3>
            <p className="text-[10px] text-gray-500">ประวัติการขอเบิกและคืนอุปกรณ์กีฬาล่าสุดในระบบ</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/admin/borrow-logs')}
          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
        >
          ดูทั้งหมด <ArrowRight size={12} />
        </button>
      </div>

      {logs.length > 0 ? (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left text-xs min-w-[420px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400">
                <th className="pb-2 font-semibold">อุปกรณ์</th>
                <th className="pb-2 font-semibold">ผู้ยืม / รหัส</th>
                <th className="pb-2 font-semibold">วันที่ทำรายการ</th>
                <th className="pb-2 font-semibold text-right">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((item) => (
                <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-2.5 font-bold text-gray-800">{item.equipment}</td>
                  <td className="py-2.5 text-gray-600">{item.userName} ({item.studentId})</td>
                  <td className="py-2.5 text-gray-500">{item.borrowDate}</td>
                  <td className="py-2.5 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.statusType === 'pending' ? 'bg-indigo-100 text-indigo-800'
                      : item.statusType === 'borrowing' ? 'bg-amber-100 text-amber-800'
                      : item.statusType === 'overdue' ? 'bg-red-100 text-red-800'
                      : 'bg-emerald-100 text-emerald-800'
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
        <div className="text-center py-6 text-gray-400 text-xs">
          ยังไม่มีข้อมูลการทำรายการยืม-คืนในระบบ
        </div>
      )}
    </div>
  );
}
