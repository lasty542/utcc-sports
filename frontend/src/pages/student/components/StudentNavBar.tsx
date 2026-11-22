import { motion } from 'framer-motion';
import type { User } from '../../../services/authService';

interface StudentNavBarProps {
  user: User | null;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function StudentNavBar({ user, currentPath, onNavigate }: StudentNavBarProps) {
  const studentId = user?.studentId || '-';

  return (
    <motion.div
      className="flex items-center justify-between bg-[#0b2b1d]/85 backdrop-blur-2xl px-4 py-2 rounded-full shadow-2xl border border-emerald-500/30 mb-5 gap-3 text-white"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
          {user?.name ? user.name.charAt(0) : 'S'}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-white">{user?.name || 'นักศึกษา'}</p>
          <p className="text-[10px] text-emerald-300 font-mono">{studentId}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-black/35 p-1 rounded-full border border-emerald-500/30">
          <button
            onClick={() => onNavigate('/student')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentPath === '/student'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('/student/qrcode')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentPath.includes('qrcode')
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            QR Code
          </button>
          <button
            onClick={() => onNavigate('/student/history')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentPath.includes('history')
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            History
          </button>
        </div>
      </div>
    </motion.div>
  );
}
