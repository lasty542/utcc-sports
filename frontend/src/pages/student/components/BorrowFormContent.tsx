/**
 * เนื้อหาแบบฟอร์มการยืมอุปกรณ์กีฬา (จำนวน, วันที่ปฏิทินยืม-คืน, ช่วงเวลา, วัตถุประสงค์)
 */
import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { X, FileText, AlertTriangle, Loader2, Receipt } from 'lucide-react';
import axios from 'axios';
import {
  borrowService,
  getUserQuota,
  type BorrowItem,
  type UserQuotaResponse,
} from '../../../services/borrowService';
import type { EquipmentItem } from '../../../services/equipService';
import { notifyBorrowUpdated } from '../../../utils/realtime';
import {
  TIME_SLOTS,
  PURPOSE_OPTIONS,
  type TimeSlot,
  type PurposeOption,
  toLocalIsoDate,
  addDays,
  formatThaiDate,
  calculateDays,
} from './borrowModalUtils';
import BorrowDateTimeInputs from './BorrowDateTimeInputs';
import BorrowSuccessView from './BorrowSuccessView';

export interface BorrowFormContentProps {
  equipment: EquipmentItem;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BorrowFormContent({ equipment, onClose, onSuccess }: BorrowFormContentProps) {
  const maxQty = Math.max(0, equipment.available);
  const equipCode = `EQ-${String(equipment.id).padStart(4, '0')}`;

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toLocalIsoDate(today), [today]);

  const [quantity, setQuantity] = useState(1);
  const [borrowDate, setBorrowDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState(() => toLocalIsoDate(addDays(today, 1)));
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('afternoon');
  const [selectedPurpose, setSelectedPurpose] = useState<PurposeOption>('เล่นกีฬา / ออกกำลังกาย');
  const [customPurpose, setCustomPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBorrow, setCreatedBorrow] = useState<BorrowItem | null>(null);
  const [quota, setQuota] = useState<UserQuotaResponse | null>(null);

  useEffect(() => {
    getUserQuota()
      .then((q) => {
        setQuota(q);
        if (q.hasOverdue) {
          setError('คุณมีรายการอุปกรณ์ที่เกินกำหนดส่งคืนค้างอยู่ กรุณานำมาคืนที่เคาน์เตอร์ก่อนส่งคำขอใหม่');
        }
      })
      .catch(() => {});
  }, []);

  const remainingQuotaItems = quota?.remainingItems ?? 3;
  const effectiveMaxQty = Math.max(0, Math.min(maxQty, remainingQuotaItems));

  const durationCount = useMemo(() => calculateDays(borrowDate, dueDate), [borrowDate, dueDate]);
  const finalPurpose = selectedPurpose === 'อื่นๆ (ระบุเอง)' ? customPurpose.trim() : selectedPurpose;
  const dueTimeLabel = TIME_SLOTS.find((s) => s.value === timeSlot)?.short || '';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (quota?.hasOverdue) {
      setError('คุณมีรายการอุปกรณ์ที่เกินกำหนดส่งคืนค้างอยู่ กรุณานำมาคืนที่เคาน์เตอร์ก่อนส่งคำขอใหม่');
      return;
    }
    if (quota && quota.remainingRequests <= 0) {
      setError('คุณมีคำขอยืมที่รอดำเนินการครบ 3 คำขอแล้ว (จำกัดสูงสุดไม่เกิน 3 คำขอพร้อมกัน)');
      return;
    }
    if (effectiveMaxQty < 1) {
      setError(
        quota && quota.remainingItems <= 0
          ? 'โควตาการยืมของคุณเต็มแล้ว (สูงสุด 3 ชิ้น)'
          : 'อุปกรณ์นี้หมดชั่วคราว ไม่สามารถทำรายการยืมได้'
      );
      return;
    }
    if (quantity < 1 || quantity > effectiveMaxQty) {
      setError(`กรุณาระบุจำนวนระหว่าง 1 ถึง ${effectiveMaxQty} ชิ้นตามโควตาคงเหลือ`);
      return;
    }
    if (!borrowDate || !dueDate || dueDate < borrowDate) {
      setError('วันที่กำหนดส่งคืนต้องไม่ย้อนหลังกว่าวันที่รับอุปกรณ์');
      return;
    }
    if (!finalPurpose) {
      setError('กรุณาระบุวัตถุประสงค์ในการยืมอุปกรณ์');
      return;
    }

    setIsSubmitting(true);
    try {
      const slotNote = timeSlot === 'morning' ? 'รอบเช้า (09:00-12:00)' : 'รอบบ่าย (13:00-17:00)';
      const borrow = await borrowService.createRequest({
        equipmentId: equipment.id,
        quantity,
        purpose: `${finalPurpose} [${slotNote}]`,
        borrowDate,
        dueDate,
      });
      setCreatedBorrow(borrow);
      onSuccess();
      notifyBorrowUpdated();
    } catch (err) {
      if (axios.isAxiosError<{ message?: string }>(err)) {
        setError(err.response?.data?.message || 'ไม่สามารถบันทึกการยืมได้ กรุณาลองใหม่');
      } else {
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdBorrow) {
    return (
      <BorrowSuccessView
        createdBorrow={createdBorrow}
        dueTimeLabel={dueTimeLabel}
        durationCount={durationCount}
        onClose={onClose}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center font-mono font-black text-emerald-800 text-xs shrink-0">
            {equipCode}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 leading-tight">{equipment.name}</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              คงเหลือพร้อมยืม{' '}
              <span className="font-bold text-emerald-700">{equipment.available}</span> / {equipment.total} ชิ้น
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-3 rounded-2xl border border-red-200 mb-3.5 font-medium">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <BorrowDateTimeInputs
          quantity={quantity}
          setQuantity={setQuantity}
          effectiveMaxQty={effectiveMaxQty}
          borrowDate={borrowDate}
          setBorrowDate={setBorrowDate}
          dueDate={dueDate}
          setDueDate={setDueDate}
          todayIso={todayIso}
          timeSlot={timeSlot}
          setTimeSlot={setTimeSlot}
          isSubmitting={isSubmitting}
        />

        {/* Purpose */}
        <div>
          <label className="font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <FileText size={13} className="text-emerald-600" /> วัตถุประสงค์การยืม
          </label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {PURPOSE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedPurpose(opt)}
                disabled={isSubmitting}
                className={`py-1.5 px-2.5 rounded-xl border text-left text-[11px] transition-all cursor-pointer truncate ${
                  selectedPurpose === opt
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {selectedPurpose === 'อื่นๆ (ระบุเอง)' && (
            <input
              type="text"
              placeholder="ระบุวัตถุประสงค์ เช่น กิจกรรมแข่งขันกีฬาคณะ..."
              value={customPurpose}
              onChange={(e) => setCustomPurpose(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs placeholder:text-gray-400"
              required
            />
          )}
        </div>

        {/* Summary Note */}
        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3 text-[11px] text-emerald-950 flex items-start gap-2">
          <Receipt size={15} className="text-emerald-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            ยืม <span className="font-bold">{equipment.name}</span> จำนวน{' '}
            <span className="font-bold">{quantity} ชิ้น</span> • คืน{' '}
            <span className="font-bold">{formatThaiDate(dueDate)}</span> ({dueTimeLabel})
            <span className="text-emerald-700 ml-1 font-bold">[{durationCount} วัน]</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isSubmitting || effectiveMaxQty < 1}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            ยืนยันส่งคำขอยืม
          </button>
        </div>
      </form>
    </div>
  );
}
