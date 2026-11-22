/**
 * หน้าต่าง Modal สำหรับนักศึกษาใช้กรอกรายละเอียดและส่งคำขอยืมอุปกรณ์กีฬา (Date Picker Calendar Version)
 */
import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Minus,
  Plus,
  Calendar,
  Clock,
  Receipt,
  CheckCircle2,
  QrCode,
  AlertCircle,
  Loader2,
  Sun,
  Sunset,
} from 'lucide-react';
import { formatEquipCode, type EquipmentItem } from '../../../services/equipService';
import {
  borrowService,
  getUserQuota,
  type BorrowItem,
  type UserQuotaResponse,
} from '../../../services/borrowService';
import { notifyBorrowUpdated } from '../../../utils/realtime';

export interface BorrowModalProps {
  equipment: EquipmentItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

type TimeSlot = 'morning' | 'afternoon';

const PURPOSE_OPTIONS = [
  'เล่นกีฬา / ออกกำลังกาย',
  'ฝึกซ้อมชมรมกีฬา',
  'กิจกรรมคณะ / แข่งขัน',
  'อื่นๆ (ระบุเอง)',
] as const;
type PurposeOption = (typeof PURPOSE_OPTIONS)[number];

// แปลงวันที่เป็นรูปแบบ ISO ตามเวลาท้องถิ่น (YYYY-MM-DD)
function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// บวกจำนวนวันที่ต้องการยืมเพิ่มจากวันที่ตั้งต้น
function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}

// แปลงวันที่ YYYY-MM-DD ให้เป็นข้อความวันที่ภาษาไทยแบบย่อ
function formatThaiDate(isoDate: string): string {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// คำนวณจำนวนวันระหว่างวันที่รับและวันที่ส่งคืน
function calculateDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 1;
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  if (!y1 || !y2) return 1;
  const dStart = new Date(y1, m1 - 1, d1).getTime();
  const dEnd = new Date(y2, m2 - 1, d2).getTime();
  const diffDays = Math.round((dEnd - dStart) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays === 0 ? 1 : diffDays);
}

// คอมโพเนนต์ฟอร์มกรอกข้อมูลการยืมอุปกรณ์และหน้าสรุปผลหลังบันทึกสำเร็จ
function BorrowFormContent({
  equipment,
  onClose,
  onSuccess,
}: {
  equipment: EquipmentItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const maxQty = Math.max(0, equipment.available);
  const equipCode = formatEquipCode(equipment.id);

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
        } else if (q.remainingItems <= 0) {
          setError('คุณใช้โควตาการยืมครบ 3 ชิ้นแล้ว ไม่สามารถยืมเพิ่มได้');
        } else if (q.remainingRequests <= 0) {
          setError('คุณมีคำขอที่รอดำเนินการครบ 2 คำขอแล้ว (จำกัดสูงสุด 2 คำขอพร้อมกัน)');
        }
      })
      .catch(() => {});
  }, []);

  const isCustomPurpose = selectedPurpose === 'อื่นๆ (ระบุเอง)';
  const finalPurpose = isCustomPurpose ? customPurpose.trim() : selectedPurpose;

  const dueTimeLabel = timeSlot === 'morning' ? 'รอบเช้า (ภายใน 12:00 น.)' : 'รอบบ่าย (ภายใน 17:00 น.)';
  const durationCount = calculateDays(borrowDate, dueDate);

  const quotaLimit = quota ? quota.remainingItems : 3;
  const effectiveMaxQty = Math.max(0, Math.min(maxQty, quotaLimit));

  // ลดจำนวนอุปกรณ์ที่ต้องการยืมลง 1 ชิ้น (ต่ำสุด 1)
  const handleDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  // เพิ่มจำนวนอุปกรณ์ที่ต้องการยืมขึ้น 1 ชิ้น (ไม่เกินคงเหลือและไม่เกินโควตา)
  const handleIncrease = () => {
    setQuantity((prev) => Math.min(effectiveMaxQty, prev + 1));
  };

  // ตรวจสอบข้อมูลฟอร์มและส่งคำขอยืมอุปกรณ์ไปยัง Backend
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (quota?.hasOverdue) {
      setError('คุณมีรายการอุปกรณ์ที่เกินกำหนดส่งคืนค้างอยู่ กรุณานำมาคืนที่เคาน์เตอร์ก่อนส่งคำขอใหม่');
      return;
    }

    if (quota && quota.remainingRequests <= 0) {
      setError('คุณมีคำขอยืมที่รอดำเนินการครบ 2 คำขอแล้ว (จำกัดสูงสุดไม่เกิน 2 คำขอพร้อมกัน)');
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
    if (!borrowDate) {
      setError('กรุณาเลือกวันที่ต้องการรับอุปกรณ์');
      return;
    }
    if (!dueDate) {
      setError('กรุณาเลือกวันที่กำหนดส่งคืน');
      return;
    }
    if (dueDate < borrowDate) {
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
      <div className="text-center py-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 size={34} />
        </div>
        <h2 className="text-lg sm:text-xl font-black text-emerald-950 mb-1">
          ส่งคำขอยืมอุปกรณ์สำเร็จ (รออนุมัติ / พร้อมรับอุปกรณ์)
        </h2>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          ระบบได้บันทึกคำขอยืมเรียบร้อยแล้ว คุณสามารถนำ QR Code ไปแสดงต่อเจ้าหน้าที่ หรือกดยืนยันรับอุปกรณ์เมื่อได้รับของ
        </p>

        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-left text-xs space-y-2 mb-5">
          <div className="flex justify-between">
            <span className="text-gray-500">รหัสคำขอยืม</span>
            <span className="font-mono font-bold text-emerald-900">
              REQ-{String(createdBorrow.id).padStart(4, '0')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">อุปกรณ์</span>
            <span className="font-bold text-gray-900">{createdBorrow.equipment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">จำนวน</span>
            <span className="font-bold text-emerald-800">{createdBorrow.qty} ชิ้น</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">วันที่รับอุปกรณ์</span>
            <span className="font-bold text-slate-800">{formatThaiDate(createdBorrow.borrowDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">กำหนดส่งคืน</span>
            <span className="font-bold text-amber-700">
              {formatThaiDate(createdBorrow.dueDate)} • {dueTimeLabel} ({durationCount} วัน)
            </span>
          </div>
          {createdBorrow.itemCodes && createdBorrow.itemCodes.length > 0 && (
            <div className="flex justify-between items-center gap-2 pt-1 border-t border-gray-100">
              <span className="text-gray-500 shrink-0">รหัสประจำชิ้น</span>
              <span className="font-mono font-black text-emerald-800 text-right">
                {createdBorrow.itemCodes.join(', ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl text-xs cursor-pointer"
          >
            ยืมอุปกรณ์ชิ้นอื่นต่อ
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/student/qrcode', { state: { borrow: createdBorrow } });
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs cursor-pointer shadow-md inline-flex items-center justify-center gap-1.5"
          >
            <QrCode size={16} /> ไปที่หน้า QR Code เพื่อรับอุปกรณ์
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Equipment Thumbnail */}
      <div className="flex items-center gap-3.5 mb-4 pr-6">
        {equipment.image && (
          <img
            src={equipment.image}
            alt={equipment.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md shrink-0"
          />
        )}
        <div className="min-w-0">
          <span className="inline-block font-mono text-[10px] font-black tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded-full mb-1">
            {equipCode} • {equipment.category || 'อุปกรณ์กีฬา'}
          </span>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">
            {equipment.name}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            คงเหลือพร้อมยืม{' '}
            <span className="font-bold text-emerald-700">{maxQty}</span> / {equipment.total} ชิ้น
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3.5 py-2.5 rounded-2xl mb-4 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs" noValidate>
        {/* Stepper จำนวนชิ้น */}
        <div>
          <label className="block font-bold text-emerald-950 mb-1.5">
            จำนวนที่ต้องการยืม (สูงสุด {maxQty} ชิ้น)
          </label>
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl p-2">
            <button
              type="button"
              onClick={handleDecrease}
              disabled={quantity <= 1 || isSubmitting}
              aria-label="ลดจำนวน"
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              <Minus size={16} />
            </button>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isNaN(val)) return;
                  setQuantity(Math.min(maxQty, Math.max(1, Math.floor(val))));
                }}
                disabled={isSubmitting}
                className="w-16 text-center text-lg font-black text-emerald-950 bg-transparent outline-none"
              />
              <span className="text-xs font-bold text-gray-500">ชิ้น</span>
            </div>
            <button
              type="button"
              onClick={handleIncrease}
              disabled={quantity >= maxQty || isSubmitting}
              aria-label="เพิ่มจำนวน"
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* ตัวเลือกปฏิทิน: วันที่รับอุปกรณ์ และ วันที่กำหนดคืน */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-800 mb-1 flex items-center gap-1.5 text-xs">
                <Calendar size={13} className="text-emerald-600" /> วันที่ต้องการรับอุปกรณ์
              </label>
              <input
                type="date"
                min={todayIso}
                value={borrowDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setBorrowDate(val);
                  if (dueDate < val) {
                    setDueDate(val);
                  }
                }}
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 mb-1 flex items-center gap-1.5 text-xs">
                <Calendar size={13} className="text-amber-600" /> วันที่กำหนดส่งคืน
              </label>
              <input
                type="date"
                min={borrowDate || todayIso}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* ตัวเลือกช่วงเวลา */}
        <div>
          <label className="font-bold text-emerald-950 mb-1.5 flex items-center gap-1.5">
            <Clock size={13} className="text-emerald-600" /> ช่วงเวลาที่รับ-ส่งคืน
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTimeSlot('morning')}
              disabled={isSubmitting}
              className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                timeSlot === 'morning'
                  ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50'
              }`}
            >
              <Sun size={14} /> รอบเช้า (09:00 - 12:00)
            </button>
            <button
              type="button"
              onClick={() => setTimeSlot('afternoon')}
              disabled={isSubmitting}
              className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                timeSlot === 'afternoon'
                  ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50'
              }`}
            >
              <Sunset size={14} /> รอบบ่าย (13:00 - 17:00)
            </button>
          </div>
        </div>

        {/* วัตถุประสงค์ (เลือกกล่องหรือระบุเองเมื่อเลือกอื่นๆ) */}
        <div>
          <label className="block font-bold text-emerald-950 mb-1.5">
            วัตถุประสงค์ในการยืม
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PURPOSE_OPTIONS.map((option) => {
              const active = selectedPurpose === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedPurpose(option);
                    if (error) setError(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl font-bold border text-[11px] transition-all cursor-pointer text-center ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-emerald-50'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {isCustomPurpose && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <input
                  id="borrow-purpose-custom"
                  type="text"
                  placeholder="ระบุวัตถุประสงค์ของคุณ..."
                  value={customPurpose}
                  onChange={(e) => {
                    setCustomPurpose(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  className="mt-2 w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Summary Box (กล่องสรุปบิลก่อนกดยืนยัน - อัปเดตแบบ Real-time) */}
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 font-black text-emerald-950 pb-1.5 border-b border-emerald-200/70">
            <Receipt size={14} className="text-emerald-700" /> สรุปรายการขอยืมอุปกรณ์
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="text-gray-600">รหัสอุปกรณ์</span>
            <span className="font-mono font-bold text-emerald-900">{equipCode}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600 shrink-0">ชื่ออุปกรณ์</span>
            <span className="font-bold text-gray-900 text-right truncate">{equipment.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">จำนวนที่ยืม</span>
            <span className="font-bold text-emerald-800">{quantity} ชิ้น</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">วันที่รับอุปกรณ์</span>
            <span className="font-bold text-slate-800">{formatThaiDate(borrowDate)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600 shrink-0">กำหนดส่งคืน</span>
            <span className="font-black text-amber-700 text-right">
              {formatThaiDate(dueDate)} • {dueTimeLabel} ({durationCount} วัน)
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600 shrink-0">วัตถุประสงค์</span>
            <span className="font-bold text-gray-800 text-right truncate">
              {finalPurpose || 'รอระบุ'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isSubmitting || maxQty < 1}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            ยืนยันการยืมอุปกรณ์
          </button>
        </div>
      </form>
    </div>
  );
}

// คอมโพเนนต์กรอบ Modal ครอบฟอร์มขอยืมอุปกรณ์
export default function BorrowModal({ equipment, onClose, onSuccess }: BorrowModalProps) {
  return (
    <AnimatePresence>
      {equipment && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            className="bg-white/90 backdrop-blur-3xl rounded-[2.2rem] p-5 sm:p-7 max-w-md w-full shadow-2xl border border-white/80 relative text-slate-900 my-auto max-h-[92vh] overflow-y-auto"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
              aria-label="ปิดหน้าต่าง"
            >
              <X size={20} />
            </button>

            <BorrowFormContent
              key={equipment.id}
              equipment={equipment}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
