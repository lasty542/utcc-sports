/**
 * หน้าบัตรดิจิทัล Dynamic QR Pass ของนักศึกษา (รีเฟรชทุก 30 วินาที)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { qrCodeStyles as styles } from './QRCode.styles';
import {
  getQrToken,
  listBorrows,
  confirmPickup,
  returnBorrow,
  type BorrowItem,
  type QrTokenResponse,
} from '../../services/borrowService';
import { notifyBorrowUpdated, subscribeBorrowUpdated } from '../../utils/realtime';
import QRCodePassCard from './components/QRCodePassCard';
import QRCodeDisplayBox from './components/QRCodeDisplayBox';
import StudentNavBar from './components/StudentNavBar';

function formatRequestCode(id: number): string {
  return `REQ-${String(id).padStart(4, '0')}`;
}

function formatThaiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function extractReturnSlotLabel(purpose: string | null): string {
  if (!purpose) return 'ภายในเวลาทำการ (17:00 น.)';
  if (purpose.includes('รอบเช้า')) return 'รอบเช้า (ภายใน 12:00 น.)';
  if (purpose.includes('รอบบ่าย')) return 'รอบบ่าย (ภายใน 17:00 น.)';
  return 'ภายในเวลาทำการ (17:00 น.)';
}

export default function StudentQRCode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const currentPath = location.pathname;
  const studentId = user?.studentId || '-';
  const routeStateBorrow = (location.state as { borrow?: BorrowItem } | null)?.borrow ?? null;
  const requestedBorrowId = Number(searchParams.get('borrowId'));

  const [borrows, setBorrows] = useState<BorrowItem[]>(() =>
    routeStateBorrow ? [routeStateBorrow] : []
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isInteger(requestedBorrowId) && requestedBorrowId > 0
      ? requestedBorrowId
      : routeStateBorrow?.id ?? null
  );
  const [tokenData, setTokenData] = useState<QrTokenResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<'student' | 'request' | null>(null);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const [isConfirmingReturn, setIsConfirmingReturn] = useState(false);
  const [pickupMessage, setPickupMessage] = useState<string | null>(null);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchToken = useCallback(async (borrowId?: number | null) => {
    try {
      setTokenError(null);
      const data = await getQrToken(borrowId ?? undefined);
      setTokenData(data);
      setSecondsLeft(data.secondsRemaining);
    } catch {
      setTokenError('ไม่สามารถสร้างรหัส QR จากเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    listBorrows().then(setBorrows).catch(() => {});
    const pollInterval = setInterval(async () => {
      try {
        const freshList = await listBorrows();
        setBorrows(freshList);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBorrowUpdated(() => {
      setToastMessage('สถานะการยืม-คืนมีการเปลี่ยนแปลง');
      setTimeout(() => setToastMessage(null), 4000);
      listBorrows().then(setBorrows).catch(() => {});
      void fetchToken(selectedId);
    });
    return () => unsubscribe();
  }, [fetchToken, selectedId]);

  useEffect(() => {
    setLoading(true);
    void fetchToken(selectedId);
  }, [selectedId, fetchToken]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void fetchToken(selectedId);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedId, fetchToken]);

  const activeBorrows = useMemo(() => {
    return borrows.filter((b) => b.statusType !== 'returned');
  }, [borrows]);

  const activeBorrow = useMemo(() => {
    if (selectedId) {
      const match = borrows.find((b) => b.id === selectedId);
      if (match) return match;
    }
    return activeBorrows[0] || borrows[0] || null;
  }, [borrows, selectedId, activeBorrows]);

  const timerPercent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));

  const qrPayload = useMemo(() => {
    if (!tokenData) return null;
    return tokenData.qrToken;
  }, [tokenData]);

  const handleCopy = (text: string, key: 'student' | 'request') => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelfConfirmPickup = async () => {
    if (!activeBorrow) return;
    setIsConfirmingPickup(true);
    setPickupError(null);
    setPickupMessage(null);
    try {
      const res = await confirmPickup(activeBorrow.id);
      setBorrows((prev) => prev.map((b) => (b.id === activeBorrow.id ? res.borrow : b)));
      setTokenData((prev) => (prev ? { ...prev, borrow: res.borrow } : prev));
      setPickupMessage(res.message || 'ยืนยันรับอุปกรณ์เรียบร้อยแล้ว');
      void fetchToken(activeBorrow.id);
      notifyBorrowUpdated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPickupError(msg || 'ไม่สามารถรับอุปกรณ์ได้');
    } finally {
      setIsConfirmingPickup(false);
    }
  };

  const handleSelfConfirmReturn = async () => {
    if (!activeBorrow) return;
    setIsConfirmingReturn(true);
    setPickupError(null);
    setPickupMessage(null);
    try {
      const res = await returnBorrow(activeBorrow.id);
      setBorrows((prev) => prev.map((b) => (b.id === activeBorrow.id ? res.borrow : b)));
      setTokenData((prev) => (prev ? { ...prev, borrow: res.borrow } : prev));
      setPickupMessage(res.message || 'บันทึกการส่งคืนอุปกรณ์สำเร็จ');
      void fetchToken(activeBorrow.id);
      notifyBorrowUpdated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPickupError(msg || 'ไม่สามารถบันทึกการคืนได้');
    } finally {
      setIsConfirmingReturn(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.bgImageOverlay} />

      <div className={styles.contentWrapper}>
        {/* Top Navbar */}
        <StudentNavBar user={user} currentPath={currentPath} onNavigate={navigate} />

        {/* Digital Borrow Pass */}
        <motion.div
          className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/80 overflow-hidden"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-800 px-6 py-5 text-white flex items-center justify-between gap-3">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">
                <Sparkles size={12} /> UTCC SPORT DIGITAL BORROW PASS
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight">
                บัตรดิจิทัลสำหรับสแกนรับ-คืนอุปกรณ์
              </h1>
            </div>
            <span
              className={`shrink-0 text-[10px] font-black px-3 py-1 rounded-full ${
                activeBorrow
                  ? activeBorrow.statusType === 'overdue'
                    ? 'bg-red-500 text-white'
                    : activeBorrow.statusType === 'pending'
                    ? 'bg-indigo-400 text-indigo-950'
                    : activeBorrow.statusType === 'returned'
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-emerald-400 text-emerald-950'
                  : 'bg-white/15 text-white'
              }`}
            >
              {activeBorrow ? activeBorrow.status : 'บัตรยืนยันตัวตน'}
            </span>
          </div>

          {/* Borrow Selector if multiple */}
          {activeBorrows.length > 1 && (
            <div className="bg-emerald-50/80 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-emerald-800 shrink-0">เลือกรายการ:</span>
              {activeBorrows.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                    activeBorrow?.id === b.id
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {formatRequestCode(b.id)} • {b.equipment}
                </button>
              ))}
            </div>
          )}

          {/* QR Code & Timer */}
          <QRCodeDisplayBox
            loading={loading}
            tokenError={tokenError}
            tokenData={tokenData}
            qrPayload={qrPayload}
            secondsLeft={secondsLeft}
            timerPercent={timerPercent}
            activeBorrow={activeBorrow}
            studentId={studentId}
            toastMessage={toastMessage}
            pickupMessage={pickupMessage}
            pickupError={pickupError}
            isConfirmingPickup={isConfirmingPickup}
            isConfirmingReturn={isConfirmingReturn}
            onRefresh={() => {
              setLoading(true);
              void fetchToken(selectedId);
            }}
            onSelfConfirmPickup={() => void handleSelfConfirmPickup()}
            onSelfConfirmReturn={() => void handleSelfConfirmReturn()}
          />

          {/* Ticket Perforation */}
          <div className="relative flex items-center px-4">
            <div className="w-6 h-6 -ml-7 rounded-full bg-emerald-950/70 shrink-0" />
            <div className="w-full border-t-2 border-dashed border-gray-200" />
            <div className="w-6 h-6 -mr-7 rounded-full bg-emerald-950/70 shrink-0" />
          </div>

          {/* Pass Details */}
          <QRCodePassCard
            activeBorrow={activeBorrow}
            studentId={studentId}
            userName={user?.name}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            formatRequestCode={formatRequestCode}
            formatThaiDate={formatThaiDate}
            extractReturnSlotLabel={extractReturnSlotLabel}
          />
        </motion.div>
      </div>
    </div>
  );
}
