import { ArrowRight, Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';

interface VerifyIdentityStep1Props {
  email: string;
  setEmail: (val: string) => void;
  studentId: string;
  setStudentId: (val: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export default function VerifyIdentityStep1({
  email,
  setEmail,
  studentId,
  setStudentId,
  isSubmitting,
  onSubmit,
  onClose,
}: VerifyIdentityStep1Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-bold text-slate-800 block mb-1">
          อีเมลของคุณ
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="เช่น yourname@gmail.com หรือ student@utcc.ac.th"
          disabled={isSubmitting}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-800 block mb-1">
          รหัสนักศึกษา / บัญชีผู้ใช้
        </label>
        <input
          type="text"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="เช่น 2410511101055 หรือ admin"
          disabled={isSubmitting}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" /> กำลังตรวจสอบ...
            </>
          ) : (
            <>
              ตรวจสอบข้อมูล <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
