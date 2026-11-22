/**
 * หน้าประวัติการยืม-คืนของนักศึกษา พร้อมตัวกรองสถานะและปุ่มเปิดดู QR Pass ของแต่ละรายการ
 */
// src/pages/Student/History.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  History as HistoryIcon,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  Loader2,
  Hourglass,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { historyStyles as styles } from './History.styles';
import { listBorrows, type BorrowItem } from '../../services/borrowService';

type StatusFilter = 'all' | 'borrowing' | 'pending' | 'returned' | 'overdue';

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'borrowing', label: 'กำลังยืม' },
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'returned', label: 'คืนแล้ว' },
  { key: 'overdue', label: 'เกินกำหนด' },
];

// แปลงรหัสการยืมตัวเลขเป็นรูปแบบ REQ-0001
function formatRequestCode(id: number): string {
  return `REQ-${String(id).padStart(4, '0')}`;
}

// แปลงวันที่ YYYY-MM-DD เป็นรูปแบบวันที่ภาษาไทยแบบย่อ
function formatThaiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ปรับค่าสถานะให้เป็นคีย์มาตรฐานสำหรับใช้แบ่งแท็บและแสดงสี Badge
function getNormalizedStatus(item: BorrowItem): Exclude<StatusFilter, 'all'> {
  const type = String(item.statusType).toLowerCase();
  if (type === 'pending' || item.status.includes('รออนุมัติ')) return 'pending';
  if (type === 'overdue') return 'overdue';
  if (type === 'returned') return 'returned';
  return 'borrowing';
}

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
    <div
      className={styles.container}
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop')`,
      }}
    >
      <div className={styles.bgImageOverlay} />

      <div className={styles.contentWrapper}>
        {/* Top Floating Capsule Navbar */}
        <motion.div
          className={styles.topBarContainer}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.leftGroup}>
            <div className={styles.avatarCircle}>
              {user?.name ? user.name.charAt(0) : 'S'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-gray-800">{user?.name || 'นักศึกษา'}</p>
              <p className="text-[10px] text-gray-500">{user?.studentId || '-'}</p>
            </div>
          </div>

          <div className={styles.rightGroup}>
            <div className={styles.switcherContainer}>
              <button
                onClick={() => navigate('/student')}
                className={`${styles.switcherBtn} ${
                  currentPath === '/student' ? styles.switcherActive : styles.switcherInactive
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/student/qrcode')}
                className={`${styles.switcherBtn} ${
                  currentPath.includes('qrcode') ? styles.switcherActive : styles.switcherInactive
                }`}
              >
                QR Code
              </button>
              <button
                onClick={() => navigate('/student/history')}
                className={`${styles.switcherBtn} ${
                  currentPath.includes('history') ? styles.switcherActive : styles.switcherInactive
                }`}
              >
                History
              </button>
            </div>
          </div>
        </motion.div>

        {/* History Main Card */}
        <motion.div
          className={styles.historyCard}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <h1 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              <HistoryIcon className="text-emerald-600" size={24} /> ประวัติการยืม-คืนอุปกรณ์กีฬา
            </h1>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full w-fit">
              ทั้งหมด {borrowHistories.length} รายการ
            </span>
          </div>
          <p className={styles.subtitle}>
            ตรวจสอบสถานะรายการอุปกรณ์ กำหนดวันส่งคืน และเปิด QR Pass สำหรับรายการที่รอรับ-คืนได้ทันที
          </p>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5">
            {STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-900 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-700'
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
            <div className={styles.tableWrapper}>
              <table className={`${styles.table} min-w-[740px]`}>
                <thead>
                  <tr>
                    <th className={styles.th}>รหัสคำขอ</th>
                    <th className={styles.th}>ชื่ออุปกรณ์</th>
                    <th className={styles.th}>จำนวน</th>
                    <th className={styles.th}>วันที่ยืม</th>
                    <th className={styles.th}>กำหนดส่งคืน</th>
                    <th className={styles.th}>สถานะ</th>
                    <th className={`${styles.th} text-center`}>QR Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistories.map((item) => {
                    const statusKey = getNormalizedStatus(item);
                    const canViewQr = statusKey !== 'returned';

                    return (
                      <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className={`${styles.td} font-mono font-bold text-emerald-900`}>
                          {formatRequestCode(item.id)}
                        </td>
                        <td className={styles.td}>
                          <p className="font-bold text-emerald-950">{item.equipment}</p>
                          {item.itemCodes && item.itemCodes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.itemCodes.map((code) => (
                                <span
                                  key={code}
                                  className="font-mono text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded"
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.purpose && (
                            <p className="text-[11px] text-gray-400 truncate max-w-[200px] mt-0.5">
                              {item.purpose}
                            </p>
                          )}
                        </td>
                        <td className={styles.td}>{item.qty} ชิ้น</td>
                        <td className={styles.td}>
                          <span className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap">
                            <Calendar size={14} className="text-emerald-600" />
                            {formatThaiDate(item.borrowDate)}
                          </span>
                        </td>
                        <td className={styles.td}>
                          <span className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap">
                            <Calendar size={14} className="text-amber-600" />
                            {formatThaiDate(item.dueDate)}
                          </span>
                        </td>
                        <td className={styles.td}>
                          {statusKey === 'borrowing' && (
                            <span className={styles.badgeBorrowing}>
                              <Clock size={12} className="inline mr-1" /> {item.status}
                            </span>
                          )}
                          {statusKey === 'pending' && (
                            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold inline-block shadow-sm">
                              <Hourglass size={12} className="inline mr-1" /> {item.status}
                            </span>
                          )}
                          {statusKey === 'returned' && (
                            <span className={styles.badgeReturned}>
                              <CheckCircle2 size={12} className="inline mr-1" /> {item.status}
                            </span>
                          )}
                          {statusKey === 'overdue' && (
                            <span className={styles.badgeOverdue}>
                              <AlertCircle size={12} className="inline mr-1" /> {item.status}
                            </span>
                          )}
                        </td>
                        <td className={`${styles.td} text-center`}>
                          {canViewQr ? (
                            <button
                              type="button"
                              onClick={() => handleOpenQrPass(item)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-[11px] transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <QrCode size={13} /> ดู QR Code
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
