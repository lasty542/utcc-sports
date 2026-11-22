/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับหน้าแสดงบัตร Dynamic QR Code ของนักศึกษา
 */
// src/pages/Student/QRCode.styles.ts
export const qrCodeStyles = {
  container: "min-h-screen bg-cover bg-center font-sans pb-16 relative overflow-x-hidden text-gray-800",
  bgImageOverlay: "absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-green-950/50 to-black/70 backdrop-blur-[3px] z-0",
  
  contentWrapper: "relative z-10 max-w-xl mx-auto px-4 w-full pt-6",

  // Top Floating Capsule Navbar
  topBarContainer: "flex items-center justify-between bg-white/75 backdrop-blur-2xl px-4 py-2.5 rounded-full shadow-xl border border-white/60 mb-6 gap-4",
  leftGroup: "flex items-center gap-3",
  avatarCircle: "w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center shadow-md overflow-hidden border-2 border-white",
  rightGroup: "flex items-center gap-3",
  switcherContainer: "flex items-center bg-gray-200/80 p-1 rounded-full shadow-inner",
  switcherBtn: "px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer",
  switcherActive: "bg-white text-emerald-900 shadow-sm",
  switcherInactive: "text-gray-600 hover:text-gray-900",

  qrCard: "bg-white/85 backdrop-blur-2xl rounded-[3rem] p-8 sm:p-10 shadow-2xl border border-white/60 relative overflow-hidden text-center",
  
  timerBadge: "bg-emerald-100 text-emerald-900 text-xs font-bold px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-6 shadow-sm mx-auto w-fit",
  
  instructionText: "text-xs text-gray-600 mb-6 max-w-md mx-auto leading-relaxed",

  qrBox: "flex justify-center mb-6",

  backBtn: "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
};