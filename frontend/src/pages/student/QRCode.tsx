/**
 * หน้าบัตรดิจิทัล Dynamic QR Pass ของนักศึกษา รีเฟรชทุก 30 วินาที พร้อมปุ่มกดยืนยันรับอุปกรณ์
 */
// src/pages/Student/QRCode.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Clock,
  ArrowLeft,
  ShieldCheck,
  Copy,
  CheckCircle2,
  Package,
  CalendarClock,
  Hash,
  UserCheck,
  Loader2,
  Sparkles,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// แปลงรหัสคำขอยืมตัวเลขเป็นรูปแบบ REQ-0001
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

// ดึงข้อความช่วงเวลาส่งคืน (รอบเช้า/รอบบ่าย) จากข้อความวัตถุประสงค์
function extractReturnSlotLabel(purpose: string | null): string {
  if (!purpose) return 'ภายในเวลาทำการ (17:00 น.)';
  if (purpose.includes('รอบเช้า')) return 'รอบเช้า (ภายใน 12:00 น.)';
  if (purpose.includes('รอบบ่าย')) return 'รอบบ่าย (ภายใน 17:00 น.)';
  return 'ภายในเวลาทำการ (17:00 น.)';
}

// คอมโพเนนต์หน้าบัตร Dynamic QR Pass สำหรับรับ-คืนอุปกรณ์
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

  // ดึง Dynamic QR Token และเวลาที่เหลือจากเซิร์ฟเวอร์
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

  // โหลดรายการยืมทั้งหมดของนักศึกษา (สำหรับเลือกสลับหลายรายการ)
  useEffect(() => {
    let active = true;
    listBorrows()
      .then((data) => {
        if (active) setBorrows(data);
      })
      .catch(() => {
        // ignore list errors if token still loads
      });
    return () => {
      active = false;
    };
  }, []);

  // Real-time Auto-polling ทุกๆ 3.5 วินาที สำหรับอัปเดตสถานะเมื่อ Admin สแกน/อนุมัติ
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const freshList = await listBorrows();
        setBorrows((prevList) => {
          // ตรวจสอบการเปลี่ยนแปลงสถานะเพื่อแจ้งเตือน
          for (const fresh of freshList) {
            const old = prevList.find((p) => p.id === fresh.id);
            if (old && old.status !== fresh.status) {
              setToastMessage(`รายการ ${formatRequestCode(fresh.id)} อัปเดตสถานะเป็น: ${fresh.status}`);
              setTimeout(() => setToastMessage(null), 4000);
            }
          }
          return freshList;
        });
      } catch {
        // Polling silent fail
      }
    }, 3500);

    return () => clearInterval(pollInterval);
  }, []);

  // โหลด Dynamic QR Token จาก Backend เมื่อเปิดหน้าหรือเปลี่ยนรายการ
  useEffect(() => {
    let active = true;
    getQrToken(selectedId ?? undefined)
      .then((data) => {
        if (active) {
          setTokenError(null);
          setTokenData(data);
          setSecondsLeft(data.secondsRemaining);
        }
      })
      .catch(() => {
        if (active) setTokenError('ไม่สามารถสร้างรหัส QR จากเซิร์ฟเวอร์ได้');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  // นับถอยหลังทุกวินาที และขอ Token ใหม่จาก Backend อัตโนมัติเมื่อครบ 30 วินาที
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
  }, [fetchToken, selectedId]);

  const activeBorrows = useMemo(
    () => borrows.filter((b) => b.statusType !== 'returned'),
    [borrows]
  );

  const activeBorrow = tokenData?.borrow ?? routeStateBorrow ?? activeBorrows[0] ?? null;
  const timerPercent = Math.round((secondsLeft / 30) * 100);

  // ข้อมูล QR Code แบบ JSON สำหรับกล้องสแกนหรือระบบตรวจสิทธิ์
  const qrPayload = useMemo(() => {
    if (!tokenData) return '';
    return JSON.stringify({
      type: 'UTCC_SPORT_PASS',
      requestId: activeBorrow?.id ?? 0,
      requestCode: activeBorrow ? formatRequestCode(activeBorrow.id) : null,
      studentId: studentId,
      token: tokenData.qrToken,
      pin: tokenData.pin,
    });
  }, [tokenData, activeBorrow, studentId]);

  // คัดลอกรหัสคำขอหรือรหัสนักศึกษาไปยังคลิปบอร์ด
  const handleCopy = (value: string, key: 'student' | 'request') => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // กดยืนยันรับอุปกรณ์ด้วยตนเองโดยใช้รหัสบัญชีที่ล็อกอินอยู่
  const handleSelfConfirmPickup = async () => {
    if (!activeBorrow || isConfirmingPickup) return;
    setIsConfirmingPickup(true);
    setPickupError(null);
    setPickupMessage(null);

    try {
      const res = await confirmPickup(activeBorrow.id);
      setBorrows((prev) => prev.map((b) => (b.id === activeBorrow.id ? res.borrow : b)));
      setTokenData((prev) => (prev ? { ...prev, borrow: res.borrow } : prev));
      setPickupMessage(res.message);
      void fetchToken(activeBorrow.id);
    } catch {
      setPickupError('ไม่สามารถยืนยันรับอุปกรณ์ได้ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่');
    } finally {
      setIsConfirmingPickup(false);
    }
  };

  // กดยืนยันคืนอุปกรณ์ด้วยตนเองโดยผูกกับบัญชีนักศึกษาปัจจุบัน
  const handleSelfConfirmReturn = async () => {
    if (!activeBorrow || isConfirmingReturn) return;
    setIsConfirmingReturn(true);
    setPickupError(null);
    setPickupMessage(null);

    try {
      const res = await returnBorrow(activeBorrow.id);
      setBorrows((prev) => prev.map((b) => (b.id === activeBorrow.id ? res.borrow : b)));
      setTokenData((prev) => (prev ? { ...prev, borrow: res.borrow } : prev));
      setPickupMessage(res.message || 'บันทึกการส่งคืนอุปกรณ์สำเร็จ');
      void fetchToken(activeBorrow.id);
    } catch {
      setPickupError('ไม่สามารถบันทึกการคืนได้ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่');
    } finally {
      setIsConfirmingReturn(false);
    }
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
              <p className="text-[10px] text-gray-500">{studentId}</p>
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

        {/* Digital Borrow Pass Card */}
        <motion.div
          className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/80 overflow-hidden"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          {/* Pass Header Banner */}
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

          {/* Active Borrow Selector */}
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

          {/* Top Pass Body: Server-Signed Dynamic QR + 30s Countdown */}
          <div className="p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-900 text-xs font-bold px-4 py-1.5 rounded-full mb-4 shadow-sm">
              <Clock size={14} className="text-emerald-700" />
              <span>รีเฟรช Dynamic QR ที่เข้ารหัสในอีก {secondsLeft} วินาที</span>
            </div>

            <div className="max-w-[230px] mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-emerald-600 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${timerPercent}%` }}
              />
            </div>

            {loading ? (
              <div className="py-12">
                <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">กำลังสร้างรหัส Dynamic QR จากเซิร์ฟเวอร์...</p>
              </div>
            ) : tokenError || !tokenData ? (
              <div className="py-10">
                <p className="text-xs font-bold text-red-600 mb-3">
                  {tokenError || 'ไม่พบข้อมูลรหัส QR'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    void fetchToken(selectedId);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} /> สร้างรหัสใหม่
                </button>
              </div>
            ) : (
              <div className="inline-flex flex-col items-center bg-white p-4 rounded-3xl border-2 border-emerald-100 shadow-lg mb-4">
                <QRCodeSVG
                  value={qrPayload || tokenData.qrToken}
                  size={196}
                  level="M"
                  fgColor="#064e3b"
                  bgColor="#ffffff"
                />
                <div className="mt-3 flex items-center gap-2 bg-emerald-950 text-emerald-300 px-3.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-widest">
                  <span>PIN: {tokenData.pin}</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">
              {activeBorrow?.statusType === 'pending' || activeBorrow?.statusType === 'approved'
                ? 'ยื่น QR Code นี้ให้เจ้าหน้าที่สแกน หรือกดยืนยันรับอุปกรณ์ด้านล่างด้วยบัญชีของคุณได้ทันที'
                : activeBorrow
                ? 'ยื่น QR Code นี้ให้เจ้าหน้าที่สแกน หรือกดยืนยันคืนอุปกรณ์ด้านล่างด้วยบัญชีของคุณเมื่อนำอุปกรณ์มาส่ง'
                : 'แสดง QR Code นี้ต่อเจ้าหน้าที่เคาน์เตอร์งานกีฬา เพื่อยืนยันตัวตน'}
            </p>

            {/* Real-time Status Toast Notification */}
            <AnimatePresence>
              {toastMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 bg-emerald-900 text-emerald-100 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg border border-emerald-500/40 inline-flex items-center gap-2"
                >
                  <Sparkles size={16} className="text-emerald-300 shrink-0" />
                  <span>{toastMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {pickupMessage && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-2.5 rounded-2xl inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{pickupMessage}</span>
              </div>
            )}

            {pickupError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-2xl">
                {pickupError}
              </div>
            )}

            {(activeBorrow?.statusType === 'pending' || activeBorrow?.statusType === 'approved') && (
              <div className="mt-4 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => void handleSelfConfirmPickup()}
                  disabled={isConfirmingPickup}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
                >
                  {isConfirmingPickup ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  กดยืนยันรับอุปกรณ์ (บัญชี: {studentId})
                </button>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  ระบบผูกกับบัญชีนักศึกษาของคุณที่เข้าสู่ระบบอยู่โดยตรง เปลี่ยนสถานะทันทีไม่ต้องกรอก PIN ซ้ำ
                </p>
              </div>
            )}

            {(activeBorrow?.statusType === 'borrowing' || activeBorrow?.statusType === 'overdue') && (
              <div className="mt-4 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => void handleSelfConfirmReturn()}
                  disabled={isConfirmingReturn}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
                >
                  {isConfirmingReturn ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  กดยืนยันคืนอุปกรณ์ (บัญชี: {studentId})
                </button>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  เมื่อนำอุปกรณ์มาส่งที่เคาน์เตอร์แล้ว สามารถกดปุ่มนี้เพื่อเปลี่ยนสถานะเป็นคืนแล้ว และคืนสต็อกเข้าคลังทันที
                </p>
              </div>
            )}
          </div>

          {/* Ticket Perforation Divider */}
          <div className="relative flex items-center px-4">
            <div className="w-6 h-6 -ml-7 rounded-full bg-emerald-950/70 shrink-0" />
            <div className="w-full border-t-2 border-dashed border-gray-200" />
            <div className="w-6 h-6 -mr-7 rounded-full bg-emerald-950/70 shrink-0" />
          </div>

          {/* Bottom Pass Body: Summary Info */}
          <div className="p-6 sm:p-8 bg-gray-50/70 text-left space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 text-[11px] font-bold mb-1">
                  <span className="inline-flex items-center gap-1">
                    <Hash size={12} className="text-emerald-600" /> รหัสคำขอยืม
                  </span>
                  {activeBorrow && (
                    <button
                      type="button"
                      onClick={() => handleCopy(formatRequestCode(activeBorrow.id), 'request')}
                      className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      title="คัดลอกรหัสคำขอ"
                    >
                      {copiedKey === 'request' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
                <p className="font-mono font-black text-sm text-emerald-950">
                  {activeBorrow ? formatRequestCode(activeBorrow.id) : 'ไม่มีรายการที่รอรับ/กำลังยืม'}
                </p>
              </div>

              <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 text-[11px] font-bold mb-1">
                  <span className="inline-flex items-center gap-1">
                    <UserCheck size={12} className="text-emerald-600" /> ผู้ยืม / รหัสนักศึกษา
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(studentId, 'student')}
                    className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    title="คัดลอกรหัสนักศึกษา"
                  >
                    {copiedKey === 'student' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="font-bold text-gray-900 truncate">{user?.name || 'นักศึกษา'}</p>
                <p className="font-mono text-[11px] text-gray-500">{studentId}</p>
              </div>

              <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
                <p className="text-gray-500 text-[11px] font-bold mb-1 inline-flex items-center gap-1">
                  <Package size={12} className="text-emerald-600" /> รายการอุปกรณ์และจำนวน
                </p>
                {activeBorrow ? (
                  <p className="font-bold text-emerald-950">
                    {activeBorrow.equipment}{' '}
                    <span className="text-emerald-700 font-black">({activeBorrow.qty} ชิ้น)</span>
                  </p>
                ) : (
                  <p className="text-gray-400 font-medium">ยังไม่มีรายการยืมที่รอรับ-คืน</p>
                )}
              </div>

              <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 shadow-sm">
                <p className="text-gray-500 text-[11px] font-bold mb-1 inline-flex items-center gap-1">
                  <CalendarClock size={12} className="text-amber-600" /> วันเวลาที่ต้องส่งคืน
                </p>
                {activeBorrow ? (
                  <div>
                    <p className="font-black text-amber-700">{formatThaiDate(activeBorrow.dueDate)}</p>
                    <p className="text-[11px] text-gray-500">
                      {extractReturnSlotLabel(activeBorrow.purpose)}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 font-medium">-</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500 pt-1">
              <ShieldCheck size={15} className="text-emerald-600" />
              QR Code ลงลายเซ็น HMAC จากเซิร์ฟเวอร์และหมดอายุอัตโนมัติป้องกันการแคปภาพใช้ซ้ำ
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => navigate('/student/history')}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold py-3 px-5 rounded-2xl transition-all cursor-pointer text-xs"
              >
                ดูประวัติการยืมทั้งหมด
              </button>
              <button type="button" onClick={() => navigate('/student')} className={`flex-1 ${styles.backBtn}`}>
                <ArrowLeft size={16} /> กลับสู่หน้าแดชบอร์ด
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
