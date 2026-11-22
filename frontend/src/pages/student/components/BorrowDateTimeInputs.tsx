import { Calendar as CalendarIcon, Clock, Minus, Plus } from 'lucide-react';
import { TIME_SLOTS, type TimeSlot } from './borrowModalUtils';

interface BorrowDateTimeInputsProps {
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  effectiveMaxQty: number;
  borrowDate: string;
  setBorrowDate: (d: string) => void;
  dueDate: string;
  setDueDate: (d: string) => void;
  todayIso: string;
  timeSlot: TimeSlot;
  setTimeSlot: (s: TimeSlot) => void;
  isSubmitting: boolean;
}

export default function BorrowDateTimeInputs({
  quantity,
  setQuantity,
  effectiveMaxQty,
  borrowDate,
  setBorrowDate,
  dueDate,
  setDueDate,
  todayIso,
  timeSlot,
  setTimeSlot,
  isSubmitting,
}: BorrowDateTimeInputsProps) {
  return (
    <>
      {/* Quantity */}
      <div>
        <label className="font-bold text-gray-700 mb-1.5 block">จำนวนที่ต้องการยืม</label>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-gray-100 rounded-2xl p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isSubmitting}
              className="w-8 h-8 rounded-xl bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center font-bold shadow-xs cursor-pointer disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span className="w-12 text-center font-bold text-sm text-gray-900 font-mono">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(effectiveMaxQty, q + 1))}
              disabled={quantity >= effectiveMaxQty || isSubmitting}
              className="w-8 h-8 rounded-xl bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center font-bold shadow-xs cursor-pointer disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-[11px] text-gray-500 font-medium">
            (โควตายืมได้สูงสุด: {effectiveMaxQty} ชิ้น)
          </span>
        </div>
      </div>

      {/* Date Selector (Calendar borrow-return) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="font-bold text-gray-700 mb-1 flex items-center gap-1.5" htmlFor="borrow-date">
            <CalendarIcon size={13} className="text-emerald-600" /> วันที่รับอุปกรณ์
          </label>
          <input
            id="borrow-date"
            type="date"
            value={borrowDate}
            min={todayIso}
            onChange={(e) => {
              setBorrowDate(e.target.value);
              if (dueDate < e.target.value) setDueDate(e.target.value);
            }}
            disabled={isSubmitting}
            className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs [color-scheme:light]"
          />
        </div>

        <div>
          <label className="font-bold text-gray-700 mb-1 flex items-center gap-1.5" htmlFor="due-date">
            <CalendarIcon size={13} className="text-emerald-600" /> วันที่กำหนดส่งคืน
          </label>
          <input
            id="due-date"
            type="date"
            value={dueDate}
            min={borrowDate || todayIso}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs [color-scheme:light]"
          />
        </div>
      </div>

      {/* Time Slots */}
      <div>
        <label className="font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
          <Clock size={13} className="text-emerald-600" /> ช่วงเวลาส่งคืน
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TIME_SLOTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setTimeSlot(s.value)}
              disabled={isSubmitting}
              className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                timeSlot === s.value
                  ? 'bg-emerald-900 border-emerald-950 text-white shadow-xs font-bold'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 font-medium'
              }`}
            >
              <div className="font-bold leading-tight">{s.label}</div>
              <div className={`text-[10px] ${timeSlot === s.value ? 'text-emerald-200' : 'text-gray-400'}`}>
                {s.short}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
