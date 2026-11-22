import { CheckCircle2, ArrowRight } from 'lucide-react';

interface InstantForgotSuccessProps {
  identifier: string;
  onResetSuccess: (identifier: string) => void;
  onClose: () => void;
}

export default function InstantForgotSuccess({
  identifier,
  onResetSuccess,
  onClose,
}: InstantForgotSuccessProps) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
        <CheckCircle2 size={32} />
      </div>
      <h4 className="text-base font-bold text-slate-900 mb-1">เปลี่ยนรหัสผ่านสำเร็จ!</h4>
      <p className="text-xs text-slate-600 mb-5 leading-relaxed">
        ระบบได้อัปเดตรหัสผ่านใหม่ของคุณเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้ทันที
      </p>
      <button
        type="button"
        onClick={() => {
          onResetSuccess(identifier);
          onClose();
        }}
        className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
      >
        เข้าสู่ระบบด้วยรหัสผ่านใหม่ <ArrowRight size={15} />
      </button>
    </div>
  );
}
