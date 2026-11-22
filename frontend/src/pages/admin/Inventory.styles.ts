/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับหน้าจัดการคลังอุปกรณ์กีฬาของเจ้าหน้าที่
 */
// src/pages/Admin/Inventory.styles.ts
export const inventoryStyles = {
  container: "min-h-screen bg-cover bg-center font-sans pb-10 relative overflow-x-hidden text-gray-800",
  bgImageOverlay: "absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-green-950/50 to-black/70 backdrop-blur-[2px] z-0",
  contentWrapper: "relative z-10 max-w-5xl mx-auto px-3 sm:px-6 pt-4",

  // Top Floating Capsule Navbar
  topBarContainer: "flex items-center justify-between bg-white/80 backdrop-blur-xl px-3 sm:px-4 py-2 rounded-full shadow-lg border border-white/60 mb-5 gap-2",
  leftGroup: "flex items-center gap-2.5",
  avatarCircle: "w-8 h-8 rounded-full bg-emerald-900 text-white text-xs font-bold flex items-center justify-center shadow-sm",
  
  rightGroup: "flex items-center gap-1.5 sm:gap-2",
  switcherContainer: "flex items-center bg-gray-200/80 p-0.5 rounded-full shadow-inner",
  switcherBtn: "px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer",
  switcherActive: "bg-emerald-900 text-white shadow-sm",
  switcherInactive: "text-gray-600 hover:text-gray-900",

  // Main Card Wrapper
  cardContainer: "bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-white/70",
  headerSection: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100",
  addBtn: "bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer self-start sm:self-auto",

  // Table
  tableWrapper: "overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0",
  table: "w-full text-left text-xs min-w-[560px]",
  th: "pb-2.5 font-bold text-gray-500 uppercase tracking-wider",
  td: "py-3 border-t border-gray-100 text-gray-700",
  actionIconBtn: "p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer inline-flex items-center justify-center"
};