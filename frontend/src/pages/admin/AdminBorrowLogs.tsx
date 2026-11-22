/**
 * หน้าตรวจสอบประวัติการยืม-คืนอุปกรณ์ทั้งหมดสำหรับเจ้าหน้าที่ (Admin Borrow Logs)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, QrCode, Loader2, AlertCircle, Layers, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  listBorrows,
  confirmPickup,
  returnBorrow,
  deleteBorrow,
  type BorrowItem,
} from '../../services/borrowService';
import { adminDashboardStyles as styles } from './AdminDashboard.styles';
import { notifyBorrowUpdated, subscribeBorrowUpdated } from '../../utils/realtime';
import ScannerModal from './components/ScannerModal';
import BorrowLogsTable from './components/BorrowLogsTable';

type StatusFilter = 'all' | 'pending' | 'borrowing' | 'overdue' | 'returned';

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติรับของ' },
  { key: 'borrowing', label: 'กำลังยืม' },
  { key: 'overdue', label: 'เกินกำหนด' },
  { key: 'returned', label: 'คืนแล้ว' },
];

function extractErrMsg(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
}

export default function AdminBorrowLogs() {
  const navigate = useNavigate();

  const [borrowList, setBorrowList] = useState<BorrowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fetchBorrows = useCallback(async () => {
    try {
      setError(null);
      const data = await listBorrows();
      setBorrowList(data);
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อโหลดประวัติการยืมได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBorrows();
    const unsubscribe = subscribeBorrowUpdated(() => void fetchBorrows());
    return () => unsubscribe();
  }, [fetchBorrows]);

  const handleConfirmPickup = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await confirmPickup(id);
      setBorrowList((prev) => prev.map((item) => (item.id === id ? res.borrow : item)));
      notifyBorrowUpdated();
    } catch (err: unknown) {
      alert(extractErrMsg(err, 'ไม่สามารถยืนยันรับอุปกรณ์ได้'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReturn = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await returnBorrow(id);
      setBorrowList((prev) => prev.map((item) => (item.id === id ? res.borrow : item)));
      notifyBorrowUpdated();
    } catch (err: unknown) {
      alert(extractErrMsg(err, 'ไม่สามารถบันทึกการคืนอุปกรณ์ได้'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการยืมนี้ออกจากระบบ?')) return;
    setProcessingId(id);
    try {
      await deleteBorrow(id);
      setBorrowList((prev) => prev.filter((item) => item.id !== id));
      notifyBorrowUpdated();
    } catch (err: unknown) {
      alert(extractErrMsg(err, 'ไม่สามารถลบรายการได้'));
    } finally {
      setProcessingId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { all: borrowList.length, pending: 0, borrowing: 0, overdue: 0, returned: 0 };
    for (const item of borrowList) {
      if (item.statusType === 'pending' || (item.statusType as string) === 'approved') c.pending++;
      else if (item.statusType === 'borrowing' || (item.statusType as string) === 'borrowed') c.borrowing++;
      else if (item.statusType === 'overdue') c.overdue++;
      else if (item.statusType === 'returned') c.returned++;
    }
    return c;
  }, [borrowList]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return borrowList.filter((item) => {
      if (activeFilter !== 'all') {
        if (activeFilter === 'pending' && item.statusType !== 'pending' && (item.statusType as string) !== 'approved') return false;
        if (activeFilter === 'borrowing' && item.statusType !== 'borrowing' && (item.statusType as string) !== 'borrowed') return false;
        if (activeFilter === 'overdue' && item.statusType !== 'overdue') return false;
        if (activeFilter === 'returned' && item.statusType !== 'returned') return false;
      }
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
    <div className={styles.container}>
      <div className={styles.bgImageOverlay} />

      <div className={styles.contentWrapper}>
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 bg-[#0b2b1d]/85 backdrop-blur-2xl px-4 sm:px-5 py-2.5 rounded-full shadow-xl border border-emerald-500/30 text-white">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/admin')}
              className="bg-emerald-800/80 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 text-xs font-bold border border-emerald-600/50"
            >
              <ArrowLeft size={14} /> กลับแดชบอร์ด
            </button>
            <h1 className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <Layers size={15} className="text-emerald-400" /> ตรวจสอบรายการยืม-คืน
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="bg-slate-900 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shadow-sm border border-white/20"
              title="เปิดกล้องสแกน QR Code"
            >
              <QrCode size={13} className="text-emerald-400" /> สแกน QR
            </button>
            <span className="text-[11px] font-black text-emerald-200 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-500/40">
              {borrowList.length} รายการ
            </span>
          </div>
        </div>

        {/* Live Queue Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <div className="bg-[#0b281c]/80 backdrop-blur-xl border border-amber-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-md">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-amber-300">คิวรอรับอุปกรณ์</p>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{counts.pending}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Clock size={16} />
            </div>
          </div>

          <div className="bg-[#0b281c]/80 backdrop-blur-xl border border-emerald-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-md">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-emerald-300">กำลังยืมใช้งาน</p>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{counts.borrowing}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Layers size={16} />
            </div>
          </div>

          <div className="bg-[#0b281c]/80 backdrop-blur-xl border border-red-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-md">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-red-300">เกินกำหนดส่ง</p>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{counts.overdue}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
              <AlertTriangle size={16} />
            </div>
          </div>

          <div className="bg-[#0b281c]/80 backdrop-blur-xl border border-emerald-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-md">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-emerald-300">คืนเรียบร้อยแล้ว</p>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{counts.returned}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 size={16} />
            </div>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl border border-white/80">
          {/* Filter Tabs + Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-4">
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
                        : 'bg-white/70 text-slate-700 hover:bg-white border border-gray-200'
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
                className="w-full pl-9 pr-3.5 py-2 bg-white/90 border border-gray-200 rounded-full text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
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
          ) : (
            <BorrowLogsTable
              logs={filteredList}
              processingId={processingId}
              onConfirmPickup={handleConfirmPickup}
              onReturn={handleReturn}
              onDelete={handleDelete}
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          )}
        </div>
      </div>

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={() => void fetchBorrows()}
      />
    </div>
  );
}
