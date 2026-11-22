/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับหน้าแสดงบัตร Dynamic QR Code ของนักศึกษา (โทนเขียวพรีเมียม Deep Forest Green)
 */
export const qrCodeStyles = {
  container:
    'min-h-screen bg-[#061a12] bg-gradient-to-b from-[#082419] via-[#061c13] to-[#030e08] font-sans pb-16 relative overflow-x-hidden text-slate-100',
  bgImageOverlay:
    'fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/12 via-transparent to-black/40 pointer-events-none z-0',

  contentWrapper: 'relative z-10 max-w-xl mx-auto px-4 w-full pt-6',

  // Top Floating Capsule Navbar
  topBarContainer:
    'flex items-center justify-between bg-[#0b2b1d]/85 backdrop-blur-2xl px-4 py-2.5 rounded-full shadow-2xl border border-emerald-500/30 mb-6 gap-4 text-white',
  leftGroup: 'flex items-center gap-3',
  avatarCircle:
    'w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shadow-md overflow-hidden border-2 border-white/20',
  rightGroup: 'flex items-center gap-3',
  switcherContainer: 'flex items-center bg-black/35 p-1 rounded-full border border-emerald-500/30',
  switcherBtn: 'px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer',
  switcherActive: 'bg-emerald-600 text-white shadow-sm',
  switcherInactive: 'text-emerald-200 hover:text-white',

  qrCard:
    'bg-white/92 backdrop-blur-2xl rounded-[3rem] p-8 sm:p-10 shadow-2xl border border-white/80 relative overflow-hidden text-center text-slate-900',

  timerBadge:
    'bg-emerald-100 text-emerald-950 text-xs font-bold px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-6 shadow-sm mx-auto w-fit',

  instructionText: 'text-xs text-gray-600 mb-6 max-w-md mx-auto leading-relaxed',

  qrBox: 'flex justify-center mb-6',

  backBtn:
    'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs',
};
