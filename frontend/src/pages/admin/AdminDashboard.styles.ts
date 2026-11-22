/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับจัดสไตล์หน้าแดชบอร์ดและหน้ารายการของเจ้าหน้าที่
 */
// src/pages/Admin/AdminDashboard.styles.ts
export const adminDashboardStyles = {
  container: "min-h-screen bg-cover bg-center font-sans pb-16 relative overflow-x-hidden text-gray-800",
  bgImageOverlay: "absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-green-950/40 to-black/60 backdrop-blur-[2px] z-0",
  
  contentWrapper: "relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-6",

  // Top Floating Capsule Navbar สำหรับ Admin
  topBarContainer: "flex items-center justify-between bg-white/75 backdrop-blur-2xl px-4 py-2.5 rounded-full shadow-xl border border-white/60 mb-8 gap-4",
  leftGroup: "flex items-center gap-3",
  avatarCircle: "w-10 h-10 rounded-full bg-emerald-900 text-white font-bold flex items-center justify-center shadow-md",
  
  rightGroup: "flex items-center gap-3",
  switcherContainer: "flex items-center bg-gray-200/80 p-1 rounded-full shadow-inner",
  switcherBtn: "px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer",
  switcherActive: "bg-emerald-900 text-white shadow-sm",
  switcherInactive: "text-gray-600 hover:text-gray-900",

  // Bento Grid หลัก
  bentoGrid: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-8",
  
  cardGlass: "bg-white/85 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-xl border border-white/60 flex flex-col justify-between",
  cardDark: "bg-emerald-950/85 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-xl border border-emerald-800/50 text-white flex flex-col justify-between",

  // Action Button
  actionBtn: "w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
};