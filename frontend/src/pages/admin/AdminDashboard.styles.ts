/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับจัดสไตล์หน้าแดชบอร์ดและหน้ารายการของเจ้าหน้าที่ (โทนเขียวพรีเมียม Deep Forest Green)
 */
export const adminDashboardStyles = {
  container:
    'min-h-screen bg-[#061a12] bg-gradient-to-b from-[#082419] via-[#061c13] to-[#030e08] font-sans pb-16 relative overflow-x-hidden text-slate-100',
  bgImageOverlay:
    'fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/12 via-transparent to-black/40 pointer-events-none z-0',

  contentWrapper: 'relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-6',

  // Top Floating Capsule Navbar สำหรับ Admin
  topBarContainer:
    'flex items-center justify-between bg-[#0b2b1d]/85 backdrop-blur-2xl px-4 py-2.5 rounded-full shadow-2xl border border-emerald-500/30 mb-8 gap-4 text-white',
  leftGroup: 'flex items-center gap-3',
  avatarCircle:
    'w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center shadow-md',

  rightGroup: 'flex items-center gap-3',
  switcherContainer: 'flex items-center bg-black/30 p-1 rounded-full border border-emerald-500/30',
  switcherBtn: 'px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer',
  switcherActive: 'bg-emerald-600 text-white shadow-sm',
  switcherInactive: 'text-emerald-200 hover:text-white',

  // Bento Grid หลัก
  bentoGrid: 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-8',

  cardGlass:
    'bg-white/92 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-white/80 flex flex-col justify-between text-slate-900',
  cardDark:
    'bg-[#0b281c]/90 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-emerald-500/30 text-white flex flex-col justify-between',

  // Action Button
  actionBtn:
    'w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer',
};
