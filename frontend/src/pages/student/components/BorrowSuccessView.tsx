/**
 * หน้าต่างแสดงผลสำเร็จหลังส่งคำขอยืมอุปกรณ์
 */
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, QrCode } from 'lucide-react';
import type { BorrowItem } from '../../../services/borrowService';
import { formatThaiDate } from './borrowModalUtils';

interface BorrowSuccessViewProps {
  createdBorrow: BorrowItem;
  dueTimeLabel: string;
  durationCount: number;
  onClose: () => void;
}

export default function BorrowSuccessView({
  createdBorrow,
  dueTimeLabel,
  durationCount,
  onClose,
}: BorrowSuccessViewProps) {
  const navigate = useNavigate();

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
