import { QRCodeSVG } from 'qrcode.react';
import { Clock, CheckCircle2, Loader2, Sparkles, RefreshCw, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BorrowItem, QrTokenResponse } from '../../../services/borrowService';

interface QRCodeDisplayBoxProps {
  loading: boolean;
  tokenError: string | null;
  tokenData: QrTokenResponse | null;
  qrPayload: string | null;
  secondsLeft: number;
  timerPercent: number;
  activeBorrow: BorrowItem | null;
  studentId: string;
  toastMessage: string | null;
  pickupMessage: string | null;
  pickupError: string | null;
  isConfirmingPickup: boolean;
  isConfirmingReturn: boolean;
  onRefresh: () => void;
  onSelfConfirmPickup: () => void;
  onSelfConfirmReturn: () => void;
}

export default function QRCodeDisplayBox({
  loading,
  tokenError,
  tokenData,
  qrPayload,
  secondsLeft,
  timerPercent,
  activeBorrow,
  studentId,
  toastMessage,
  pickupMessage,
  pickupError,
  isConfirmingPickup,
  isConfirmingReturn,
  onRefresh,
  onSelfConfirmPickup,
  onSelfConfirmReturn,
}: QRCodeDisplayBoxProps) {
  return (
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
          <p className="text-xs font-bold text-red-600 mb-3">{tokenError || 'ไม่พบข้อมูลรหัส QR'}</p>
          <button
            type="button"
            onClick={onRefresh}
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
            onClick={onSelfConfirmPickup}
            disabled={isConfirmingPickup}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
          >
            {isConfirmingPickup ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            กดยืนยันรับอุปกรณ์ (บัญชี: {studentId})
          </button>
        </div>
      )}

      {(activeBorrow?.statusType === 'borrowing' || activeBorrow?.statusType === 'overdue') && (
        <div className="mt-4 max-w-sm mx-auto">
          <button
            type="button"
            onClick={onSelfConfirmReturn}
            disabled={isConfirmingReturn}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
          >
            {isConfirmingReturn ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            กดยืนยันคืนอุปกรณ์ (บัญชี: {studentId})
          </button>
        </div>
      )}
    </div>
  );
}
