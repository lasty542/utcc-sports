/**
 * หน้าตรวจสอบและจัดการรายการยืม-คืนทั้งหมดสำหรับเจ้าหน้าที่ (กรองสถานะ, ค้นหา, อนุมัติรับ/คืน, ลบ)
 */
// src/pages/Admin/AdminBorrowLogs.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { adminDashboardStyles as styles } from './AdminDashboard.styles';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Trash2, Loader2, Search } from 'lucide-react';
import {
  listBorrows,
  verifyScan,
  deleteBorrow,
  type BorrowItem,
} from '../../services/borrowService';

const SCENIC_MEADOW_BG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop';

type LogFilter = 'all' | 'pending' | 'borrowing' | 'overdue' | 'returned';

const FILTER_TABS: Array<{ key: LogFilter; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติรับของ' },
  { key: 'borrowing', label: 'กำลังยืม' },
  { key: 'overdue', label: 'เกินกำหนด' },
  { key: 'returned', label: 'คืนแล้ว' },
];

// ดึงข้อความ Error จาก Axios Response หรือใช้ข้อความเริ่มต้น
function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

// คอมโพเนนต์ตารางตรวจสอบรายการยืม-คืนทั้งหมดของเจ้าหน้าที่
export default function AdminBorrowLogs() {
  const navigate = useNavigate();

  const [borrowList, setBorrowList] = useState<BorrowItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<LogFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // โหลดรายการยืม-คืนทั้งหมดจากเซิร์ฟเวอร์
  const fetchBorrows = useCallback(async () => {
    try {
      setError(null);
      const data = await listBorrows();
      setBorrowList(data);
    } catch (err) {
      setError(getErrorMessage(err, 'ไม่สามารถโหลดรายการยืม-คืนได้'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    listBorrows()
      .then((data) => {
        if (active) {
          setError(null);
          setBorrowList(data);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(getErrorMessage(err, 'ไม่สามารถโหลดรายการยืม-คืนได้'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // อนุมัติรับของ / รับคืนอุปกรณ์ผ่าน POST /api/borrow/verify-scan
  const handleProcessItem = async (id: number) => {
    setProcessingId(id);
    try {
      const { borrow: updated } = await verifyScan(String(id));
      setBorrowList((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      alert(getErrorMessage(err, 'ไม่สามารถอัปเดตรายการได้'));
    } finally {
      setProcessingId(null);
    }
  };

  // ลบรายการผ่าน DELETE /api/borrow/:id
  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return;

    setProcessingId(id);
    try {
      await deleteBorrow(id);
      setBorrowList((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert(getErrorMessage(err, 'ไม่สามารถลบรายการได้'));
    } finally {
      setProcessingId(null);
    }
  };

  const counts = useMemo(() => {
    const map: Record<LogFilter, number> = {
      all: borrowList.length,
      pending: 0,
      borrowing: 0,
      overdue: 0,
      returned: 0,
    };
    borrowList.forEach((item) => {
      map[item.statusType] += 1;
    });
    return map;
  }, [borrowList]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return borrowList.filter((item) => {
      if (activeFilter !== 'all' && item.statusType !== activeFilter) return false;
      if (!q) return true;
      return (
        item.userName.toLowerCase().includes(q) ||
        item.studentId.toLowerCase().includes(q) ||
        item.equipment.toLowerCase().includes(q) ||
        `req-${String(item.id).padStart(4, '0')}`.includes(q)
      );
    });
  }, [borrowList, activeFilter, search]);

  return (
    <div
      className={styles.container}
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      <div className="fixed inset-0 bg-gradient-to-b from-sky-900/15 via-emerald-950/10 to-emerald-950/35 pointer-events-none z-0" />

      <div className={styles.contentWrapper}>
        {/* Top Header & Back Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white/75 backdrop-blur-2xl backdrop-saturate-150 px-5 py-3.5 rounded-full shadow-xl border border-white/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-950 px-3.5 py-2 rounded-full transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft size={16} /> กลับหน้าแดชบอร์ด
            </button>
            <h1 className="text-base sm:text-lg font-black text-emerald-950">ตรวจสอบรายการยืม-คืนอุปกรณ์</h1>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-white/80 px-3.5 py-1 rounded-full border border-white">
            ทั้งหมด {borrowList.length} รายการ
          </span>
        </div>

        {/* ตารางแสดงรายการยืมของนักศึกษา */}
        <div className="bg-white/80 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] p-5 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.16)] border border-white/85">
          {/* Filter Tabs + Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {FILTER_TABS.map((tab) => {
                const isActive = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white/70 text-slate-700 hover:bg-white border border-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {counts[tab.key]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-64 shrink-0">
              <Search className="absolute left-3.5 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหารหัส, ชื่อผู้ยืม, อุปกรณ์..."
                className="w-full pl-9 pr-3.5 py-2 bg-white/80 border border-white rounded-full text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">กำลังโหลดรายการยืม-คืน...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">
              <AlertCircle size={36} className="mx-auto mb-2" />
              <p className="text-xs font-bold">{error}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  void fetchBorrows();
                }}
                className="mt-3 text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
              >
                ลองใหม่
              </button>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Clock size={44} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">ไม่มีรายการที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[740px]">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-black text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">รหัส</th>
                    <th className="py-3 px-4">ผู้ยืม / รหัส</th>
                    <th className="py-3 px-4">อุปกรณ์</th>
                    <th className="py-3 px-4">จำนวน</th>
                    <th className="py-3 px-4">วันที่ยืม - กำหนดคืน</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-800">
                  {filteredList.map((item) => {
                    const isPending = item.statusType === 'pending';
                    const isReturned = item.statusType === 'returned';
                    const isOverdue = item.statusType === 'overdue';
                    const isBusy = processingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-emerald-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-900">
                          REQ-{String(item.id).padStart(4, '0')}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900">{item.userName}</p>
                          <p className="text-[11px] text-gray-500">{item.studentId}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-emerald-950">{item.equipment}</p>
                          {item.purpose && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[180px]">
                              {item.purpose}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">{item.qty} ชิ้น</td>
                        <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                          {item.borrowDate} {item.dueDate ? `ถึง ${item.dueDate}` : ''}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-black inline-flex items-center gap-1 ${
                              isReturned
                                ? 'bg-gray-100 text-gray-600'
                                : isPending
                                ? 'bg-indigo-100 text-indigo-800'
                                : isOverdue
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isReturned ? (
                              <CheckCircle2 size={12} />
                            ) : isOverdue ? (
                              <AlertCircle size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center space-x-2 whitespace-nowrap">
                          {!isReturned ? (
                            <button
                              onClick={() => void handleProcessItem(item.id)}
                              disabled={isBusy}
                              className={`${
                                isPending
                                  ? 'bg-indigo-600 hover:bg-indigo-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              } disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-xl text-[11px] transition-all cursor-pointer shadow inline-flex items-center gap-1`}
                            >
                              {isBusy && <Loader2 size={12} className="animate-spin" />}
                              {isPending ? 'อนุมัติรับอุปกรณ์' : 'รับคืนอุปกรณ์'}
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                              คืนแล้ว
                            </span>
                          )}
                          <button
                            onClick={() => void handleDeleteItem(item.id)}
                            disabled={isBusy}
                            className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1.5 transition-colors cursor-pointer inline-block align-middle"
                            title="ลบรายการ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
