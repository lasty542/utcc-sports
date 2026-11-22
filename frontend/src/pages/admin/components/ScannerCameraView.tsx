import type { RefObject } from 'react';
import { Camera, Loader2, Upload, RefreshCw } from 'lucide-react';

interface ScannerCameraViewProps {
  cameraError: string | null;
  isSubmitting: boolean;
  qrReaderId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSwitchToManual: () => void;
  onRetryCamera: () => void;
  onClose: () => void;
}

export default function ScannerCameraView({
  cameraError,
  isSubmitting,
  qrReaderId,
  fileInputRef,
  onSwitchToManual,
  onRetryCamera,
  onClose,
}: ScannerCameraViewProps) {
  return (
    <div>
      {cameraError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center mb-3">
          <Camera size={32} className="text-amber-600 mx-auto mb-2" />
          <p className="text-xs font-bold text-amber-900 mb-3 leading-relaxed">
            {cameraError}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={onRetryCamera}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RefreshCw size={13} /> ลองเปิดกล้องใหม่
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border border-amber-300 text-amber-900 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 hover:bg-amber-100/50"
            >
              <Upload size={13} /> อัปโหลดรูป QR
            </button>
            <button
              type="button"
              onClick={onSwitchToManual}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer"
            >
              คลิกยืนยันจากรายชื่อ
            </button>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 mb-3 min-h-[240px]">
          <div id={qrReaderId} className="w-full" />
          {isSubmitting && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
              <Loader2 size={28} className="animate-spin mb-2" />
              <p className="text-xs font-bold">กำลังตรวจสอบรหัส...</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSubmitting}
          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5"
        >
          <Upload size={14} /> อัปโหลดภาพ QR
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
}
