/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับหน้าประวัติการยืม-คืนของนักศึกษา
 */
// src/pages/Student/History.styles.ts
export const historyStyles = {
  container: "min-h-screen bg-cover bg-center font-sans pb-16 relative overflow-x-hidden text-gray-800",
  bgImageOverlay: "absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-green-900/30 to-black/50 backdrop-blur-[2px] z-0",
  
  contentWrapper: "relative z-10 max-w-5xl mx-auto px-4 sm:px-8 pt-6",

  // Top Floating Capsule Navbar
  topBarContainer: "flex items-center justify-between bg-white/75 backdrop-blur-2xl px-4 py-2.5 rounded-full shadow-xl border border-white/60 mb-8 gap-4",
  leftGroup: "flex items-center gap-3",
  avatarCircle: "w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center shadow-md",
  
  rightGroup: "flex items-center gap-3",
  switcherContainer: "flex items-center bg-gray-200/80 p-1 rounded-full shadow-inner",
  switcherBtn: "px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer",
  switcherActive: "bg-white text-emerald-900 shadow-sm",
  switcherInactive: "text-gray-600 hover:text-gray-900",

  // Card หลักสำหรับแสดงตารางประวัติ
  historyCard: "bg-white/85 backdrop-blur-2xl rounded-[3rem] p-6 sm:p-10 shadow-2xl border border-white/60 relative overflow-hidden",
  sectionTitle: "text-xl sm:text-2xl font-black text-emerald-950 mb-2 flex items-center gap-2",
  subtitle: "text-gray-500 text-sm mb-6",

  // ตารางประวัติ
  tableWrapper: "overflow-x-auto",
  table: "w-full text-left border-collapse",
  th: "py-3 px-4 text-xs font-black uppercase tracking-wider text-emerald-900 border-b border-gray-200/60 bg-emerald-50/50",
  td: "py-4 px-4 text-sm text-gray-700 border-b border-gray-100 font-medium",
  
  // Badge สถานะ
  badgeBorrowing: "bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold inline-block shadow-sm",
  badgeReturned: "bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold inline-block shadow-sm",
  badgeOverdue: "bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold inline-block shadow-sm"
};