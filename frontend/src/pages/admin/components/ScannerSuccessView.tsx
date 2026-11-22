import { CheckCircle2 } from 'lucide-react';

interface ScannerSuccessViewProps {
  message: string;
  onClose: () => void;
}

export default function ScannerSuccessView({ message, onClose }: ScannerSuccessViewProps) {
  return (
    <div className="text-center py-4">
      <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
        <CheckCircle2 size={28} />
      </div>
      <h2 className="text-lg font-black text-emerald-950 mb-1">ทำรายการสำเร็จ!</h2>
      <p className="text-xs text-gray-600 mb-5 leading-relaxed">{message}</p>
      <button
        onClick={onClose}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-md"
      >
        เสร็จสิ้น / ปิดหน้าต่าง
      </button>
    </div>
  );
}
