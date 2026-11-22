/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับหน้าประวัติการยืม-คืนของนักศึกษา
 * กล่องสีขาวสว่าง ชัดเจน สวยงามเหมือนหน้า admin/inventory (Image 3)
 */
export const historyStyles = {
  container:
    'min-h-screen bg-[#061a12] bg-gradient-to-b from-[#082419] via-[#061c13] to-[#030e08] font-sans pb-16 relative overflow-x-hidden text-slate-100',
  bgImageOverlay:
    'fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/12 via-transparent to-black/40 pointer-events-none z-0',

  contentWrapper: 'relative z-10 max-w-5xl mx-auto px-3 sm:px-6 pt-4',

  // Top Floating Capsule Navbar
  topBarContainer:
    'flex items-center justify-between bg-[#0b2b1d]/85 backdrop-blur-2xl px-4 py-2.5 rounded-full shadow-2xl border border-emerald-500/30 mb-5 gap-4 text-white',
  leftGroup: 'flex items-center gap-3',
  avatarCircle:
    'w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shadow-md',

  rightGroup: 'flex items-center gap-3',
  switcherContainer: 'flex items-center bg-black/35 p-1 rounded-full border border-emerald-500/30',
  switcherBtn: 'px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer',
  switcherActive: 'bg-emerald-600 text-white shadow-sm',
  switcherInactive: 'text-emerald-200 hover:text-white',

  // Card หลักสำหรับแสดงตารางประวัติ (Solid White Card เหมือน admin/inventory)
  historyCard:
    'bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-white relative overflow-hidden text-slate-900',
  sectionTitle: 'text-base sm:text-lg font-black text-slate-900 mb-1 flex items-center gap-2',
  subtitle: 'text-slate-500 text-xs mb-4',

  // ตารางประวัติ
  tableWrapper: 'overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0',
  table: 'w-full text-left border-collapse text-xs',
  th: 'py-2.5 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 border-b border-gray-200 bg-slate-50',
  td: 'py-3 px-3 text-xs text-slate-800 border-b border-gray-100 font-medium',

  // Badge สถานะ
  badgeBorrowing:
    'bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block shadow-xs',
  badgeReturned:
    'bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block shadow-xs',
  badgeOverdue:
    'bg-red-100 text-red-900 border border-red-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block shadow-xs',
};
