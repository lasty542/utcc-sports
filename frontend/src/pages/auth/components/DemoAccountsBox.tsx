/**
 * กล่องข้อมูลและปุ่มคลิกกรอกบัญชีทดสอบอัตโนมัติ (Demo Accounts)
 */
import { KeyRound } from 'lucide-react';

interface DemoAccountsBoxProps {
  onSelectAccount: (identifier: string, pass: string) => void;
}

export default function DemoAccountsBox({ onSelectAccount }: DemoAccountsBoxProps) {
  return (
    <div className="mt-3.5 pt-3 border-t border-slate-100">
      <details className="group">
        <summary className="flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer list-none select-none py-1">
          <span className="flex items-center gap-1.5">
            <KeyRound size={13} className="text-emerald-600" /> บัญชีสำหรับทดสอบระบบ (คลิกเพื่อเลือก)
          </span>
          <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="mt-2 bg-slate-50/90 rounded-xl p-2 space-y-1.5 border border-slate-200/70 text-[11px]">
          <button
            type="button"
            onClick={() => onSelectAccount('admin', 'admin1234')}
            className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer transition-all text-left"
            title="คลิกเพื่อกรอกอัตโนมัติ"
          >
            <span>
              🛡️ Admin: <strong className="text-slate-800">admin</strong>
            </span>
            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
              admin1234
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelectAccount('2410511101055', '123456')}
            className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer transition-all text-left"
            title="คลิกเพื่อกรอกอัตโนมัติ"
          >
            <span>
              🎓 Student: <strong className="text-emerald-700">2410511101055</strong>
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
              123456
            </span>
          </button>
        </div>
      </details>
    </div>
  );
}
