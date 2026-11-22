/**
 * หน้าประวัติการยืม-คืนของนักศึกษา พร้อมตัวกรองสถานะและปุ่มเปิดดู QR Pass ของแต่ละรายการ
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  History as HistoryIcon,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { historyStyles as styles } from './History.styles';
import { listBorrows, type BorrowItem } from '../../services/borrowService';
import {
  type StatusFilter,
  STATUS_TABS,
  getNormalizedStatus,
} from './components/historyUtils';
import HistoryTable from './components/HistoryTable';
import StudentNavBar from './components/StudentNavBar';

// คอมโพเนนต์หน้าแสดงประวัติการยืม-คืนของนักศึกษา
export default function StudentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const [borrowHistories, setBorrowHistories] = useState<BorrowItem[]>([]);
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // โหลดรายการประวัติการยืม-คืนของนักศึกษาจาก API ใหม่
  const reloadHistories = useCallback(async () => {
    try {
      setError(null);
      const data = await listBorrows();
      setBorrowHistories(data);
    } catch (err) {
      const msg = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message || 'ไม่สามารถโหลดประวัติการยืม-คืนได้'
        : 'ไม่สามารถโหลดประวัติการยืม-คืนได้';
      setError(msg);
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
          setBorrowHistories(data);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = axios.isAxiosError<{ message?: string }>(err)
            ? err.response?.data?.message || 'ไม่สามารถโหลดประวัติการยืม-คืนได้'
            : 'ไม่สามารถโหลดประวัติการยืม-คืนได้';
          setError(msg);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const summary: Record<StatusFilter, number> = {
      all: borrowHistories.length,
      borrowing: 0,
      pending: 0,
      returned: 0,
      overdue: 0,
    };
    borrowHistories.forEach((item) => {
      summary[getNormalizedStatus(item)] += 1;
    });
    return summary;
  }, [borrowHistories]);

  const filteredHistories = useMemo(() => {
    if (activeTab === 'all') return borrowHistories;
    return borrowHistories.filter((item) => getNormalizedStatus(item) === activeTab);
  }, [borrowHistories, activeTab]);

  // นำทางไปยังหน้า QR Code พร้อมส่งรหัสคำขอยืมที่ต้องการแสดง
  const handleOpenQrPass = (item: BorrowItem) => {
    navigate(`/student/qrcode?borrowId=${item.id}`, { state: { borrow: item } });
  };

  return (
    <div className={styles.container}>
      <div className={styles.bgImageOverlay} />

      <div className={styles.contentWrapper}>
        {/* Top Floating Capsule Navbar */}
        <StudentNavBar user={user} currentPath={currentPath} onNavigate={navigate} />

        {/* History Main Card */}
        <motion.div
          className={styles.historyCard}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-100 text-emerald-800 p-1.5 rounded-lg">
                <HistoryIcon size={18} />
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900">
                ประวัติการยืม-คืนอุปกรณ์กีฬา
              </h1>
            </div>
            <span className="text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full w-fit">
              ทั้งหมด {borrowHistories.length} รายการ
            </span>
          </div>
          <p className="text-slate-500 text-xs mb-4">
            ตรวจสอบสถานะรายการอุปกรณ์ กำหนดวันส่งคืน และเปิด QR Pass สำหรับรายการที่รอรับ-คืนได้ทันที
          </p>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4">
            {STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="text-center py-14">
              <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">กำลังโหลดประวัติการยืม-คืน...</p>
            </div>
          ) : error ? (
            <div className="text-center py-14 text-red-500">
              <AlertCircle size={34} className="mx-auto mb-2" />
              <p className="text-xs font-bold mb-3">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void reloadHistories();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} /> ลองใหม่
              </button>
            </div>
          ) : filteredHistories.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <Clock size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">ไม่มีรายการในสถานะนี้</p>
            </div>
          ) : (
            <HistoryTable items={filteredHistories} onOpenQrPass={handleOpenQrPass} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
