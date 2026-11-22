/**
 * หน้าแดชบอร์ดหลักสำหรับนักศึกษา (Student Dashboard)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LogOut,
  Settings,
  Bell,
  RefreshCw,
  Trophy,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { listEquipment, type EquipmentItem } from '../../services/equipService';
import {
  getUserQuota,
  listBorrows,
  type BorrowItem,
  type UserQuotaResponse,
} from '../../services/borrowService';
import { subscribeBorrowUpdated } from '../../utils/realtime';
import BorrowModal from './components/BorrowModal';
import SettingsModal from '../../components/SettingsModal';
import EquipmentCard from './components/EquipmentCard';
import DashboardHero from './components/DashboardHero';
import { dashboardStyles as styles } from './Dashboard.styles';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [selectedEquip, setSelectedEquip] = useState<EquipmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLoans, setActiveLoans] = useState<BorrowItem[]>([]);
  const [quota, setQuota] = useState<UserQuotaResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  const reloadEquipments = useCallback(async () => {
    try {
      const data = await listEquipment();
      setEquipments(data);
      setError(null);
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อโหลดอุปกรณ์ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadUserLoans = useCallback(async () => {
    try {
      const [borrows, quotaData] = await Promise.all([listBorrows(), getUserQuota()]);
      const active = borrows.filter(
        (b) =>
          b.statusType === 'pending' ||
          b.statusType === 'borrowing' ||
          b.statusType === 'overdue'
      );
      setActiveLoans(active);
      setQuota(quotaData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void reloadEquipments();
    void reloadUserLoans();

    const unsubscribe = subscribeBorrowUpdated(() => {
      void reloadEquipments();
      void reloadUserLoans();
    });

    return () => {
      unsubscribe();
    };
  }, [reloadEquipments, reloadUserLoans]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const freshBorrows = await listBorrows();
        setActiveLoans((prev) => {
          for (const fresh of freshBorrows) {
            const old = prev.find((p) => p.id === fresh.id);
            if (old && old.status !== fresh.status) {
              setRealtimeToast(
                `รายการ "${fresh.equipment}" เปลี่ยนสถานะเป็น: ${fresh.status}`
              );
              setTimeout(() => setRealtimeToast(null), 4000);
              break;
            }
          }
          return freshBorrows.filter(
            (b) =>
              b.statusType === 'pending' ||
              b.statusType === 'borrowing' ||
              b.statusType === 'overdue'
          );
        });
      } catch {
        // ignore
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => {
      if (e.category) set.add(e.category.trim());
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [equipments]);

  const filteredEquipments = useMemo(() => {
    return equipments.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `EQ-${String(item.id).padStart(4, '0')}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [equipments, searchQuery, selectedCategory]);

  return (
    <div className={styles.container}>
      <div className={styles.bgGlowOverlay} />

      {/* Realtime Toast Notification */}
      {realtimeToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-xl text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/20 text-xs font-bold animate-bounce">
          <Bell size={15} className="text-amber-400" />
          <span>{realtimeToast}</span>
        </div>
      )}

      <div className={styles.contentWrapper}>
        {/* Top Floating App Bar */}
        <header className={styles.topBar}>
          <div className="flex items-center gap-3">
            <span className={styles.brandTitle}>UTCC SPORT</span>
            <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase">
              STUDENT PORTAL
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={styles.iconButton}
              title="ตั้งค่าบัญชี"
            >
              <Settings size={17} />
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500/80 hover:bg-red-600 backdrop-blur-xl border border-white/40 text-white flex items-center justify-center cursor-pointer shadow-lg transition-all"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Dashboard Hero Grid */}
        <DashboardHero
          user={user}
          quota={quota}
          activeCount={activeLoans.length}
          equipments={equipments}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigate={navigate}
          onSelectEquip={(eq) => setSelectedEquip(eq)}
        />

        {/* Catalog Section Header */}
        <div className={styles.sectionHeader}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className={styles.sectionTitle}>
              <Trophy className="text-amber-300" size={20} />
              คลังอุปกรณ์กีฬาคงเหลือเรียลไทม์ (Equipment Catalog)
            </h2>
            <span className="text-xs font-bold bg-white/25 text-white px-3 py-1 rounded-full w-fit border border-white/30">
              แสดง {filteredEquipments.length} จาก {equipments.length} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/35 border border-white/25'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Equipment Grid */}
        {loading ? (
          <div className="bg-white/30 backdrop-blur-2xl rounded-[2.2rem] p-12 text-center text-white border border-white/40 shadow-xl">
            <Loader2 size={32} className="animate-spin text-white mx-auto mb-2" />
            <p className="text-xs font-bold">กำลังโหลดรายการอุปกรณ์กีฬา...</p>
          </div>
        ) : error ? (
          <div className="bg-white/35 backdrop-blur-2xl rounded-[2.2rem] p-12 text-center text-slate-900 border border-white/50 shadow-xl">
            <AlertCircle size={32} className="text-red-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-red-700 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void reloadEquipments();
              }}
              className="bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} /> โหลดข้อมูลใหม่
            </button>
          </div>
        ) : filteredEquipments.length === 0 ? (
          <div className="bg-white/25 backdrop-blur-2xl rounded-[2.2rem] p-12 text-center text-white border border-white/40 shadow-xl">
            <Trophy size={36} className="mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold">ไม่พบอุปกรณ์ที่ตรงกับการค้นหาหรือหมวดหมู่ที่เลือก</p>
          </div>
        ) : (
          <div className={styles.equipmentGrid}>
            {filteredEquipments.map((item, index) => (
              <EquipmentCard
                key={item.id}
                item={item}
                index={index}
                onSelect={(eq) => setSelectedEquip(eq)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Borrow Modal */}
      {selectedEquip && (
        <BorrowModal
          equipment={selectedEquip}
          onClose={() => setSelectedEquip(null)}
          onSuccess={() => {
            void reloadEquipments();
            void reloadUserLoans();
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={user}
        onLogout={() => navigate('/')}
      />
    </div>
  );
}
