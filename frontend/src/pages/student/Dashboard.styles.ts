/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับจัดสไตล์หน้าแดชบอร์ดนักศึกษาและ Modal ยืมอุปกรณ์ (ธีม Deep Forest Green ตาม PDF)
 */
export const dashboardStyles = {
  container:
    'min-h-screen bg-[#061a12] bg-gradient-to-b from-[#082419] via-[#061c13] to-[#030e08] font-sans pb-24 relative overflow-x-hidden text-slate-100',
  bgGlowOverlay:
    'fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/15 via-transparent to-black/50 pointer-events-none z-0',

  contentWrapper: 'relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-5',

  // Top Floating Bar
  headerNavbar:
    'flex flex-wrap items-center justify-between gap-2.5 mb-5',
  brandLogo: 'text-base sm:text-lg font-black tracking-tight uppercase text-white',
  warningBadge:
    'hidden sm:inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase',

  menuBtn:
    'bg-[#0d3322] hover:bg-[#113f2a] backdrop-blur-2xl text-white border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all shadow-lg flex items-center gap-1.5 cursor-pointer',
  userStatsPill:
    'hidden md:flex items-center gap-2 bg-[#0b2b1d]/85 backdrop-blur-2xl border border-emerald-500/30 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg text-emerald-200',

  bentoMainGrid: 'grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 mb-6',

  // Cream Editorial Card (รูปที่ 5 ใน PDF)
  heroCard:
    'bg-[#f5eedb] text-slate-900 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 shadow-xl border border-white/60 flex flex-col justify-between relative overflow-hidden',
  heroTitle:
    'text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-1.5 text-slate-950 uppercase leading-tight',
  heroSubtitle: 'text-slate-700 text-xs sm:text-sm leading-relaxed font-medium',

  // Bento Boxes
  actionBoxGreen:
    'bg-[#0d2f1f] hover:bg-[#113a27] backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-lg border border-emerald-500/30 cursor-pointer transition-all text-white',
  actionBoxLight:
    'bg-[#edf4ee] hover:bg-white backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-lg border border-white/80 cursor-pointer transition-all text-slate-900',

  searchBoxCard:
    'bg-[#0b2b1d]/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-lg border border-emerald-500/30 text-white',
  searchInput:
    'w-full pl-9 pr-3.5 py-2 bg-black/30 border border-emerald-500/30 rounded-full text-xs font-bold text-white placeholder:text-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner',

  graphicCardSide:
    'relative h-32 sm:h-36 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-emerald-500/30 group cursor-pointer',

  sectionHeader:
    'bg-[#0b2b1d]/80 backdrop-blur-2xl px-4 sm:px-5 py-3 rounded-2xl border border-emerald-500/30 shadow-lg mb-4 sm:mb-5 space-y-2.5',
  sectionTitle: 'text-sm sm:text-base font-black text-white flex items-center gap-2',

  // Squircle Catalog Cards (2 cols on mobile, 3 on tablet, 4 on desktop)
  equipmentGrid: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4',
  equipmentCard:
    'bg-[#0b2a1c]/90 hover:bg-[#0e3523] backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-lg border border-emerald-500/25 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between overflow-hidden h-full relative cursor-pointer text-white',
  equipmentImageWrapper:
    'p-3 sm:p-4 pb-2 relative flex flex-col items-center w-full flex-1 justify-start',
  equipmentContent: 'px-3 sm:px-4 pb-3 sm:pb-4 pt-0 flex flex-col w-full z-10',
  actionBtn:
    'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 sm:py-2.5 px-3 rounded-xl sm:rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-[11px] sm:text-xs',

  filterContainer: 'relative',
  dropdownToggleBtn:
    'bg-[#0d3322] hover:bg-[#113f2a] text-white px-4 py-2 rounded-full font-black text-xs shadow-md border border-emerald-500/30 flex items-center gap-2 cursor-pointer transition-all',
  dropdownMenu:
    'absolute right-0 mt-2 w-44 bg-[#0b2b1d]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-emerald-500/40 py-1.5 z-30',
  dropdownItem:
    'w-full text-left px-3.5 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-800/50 hover:text-white transition-colors cursor-pointer',

  // App Bar & Hero Helpers
  topBar:
    'flex flex-wrap items-center justify-between gap-2.5 mb-4 sm:mb-6 bg-[#0b2b1d]/85 backdrop-blur-2xl px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-emerald-500/30 shadow-xl text-white',
  brandTitle: 'text-base sm:text-lg font-black tracking-tight uppercase text-white',
  iconButton:
    'bg-[#0d3322] hover:bg-[#113f2a] backdrop-blur-2xl text-emerald-300 hover:text-white border border-emerald-500/30 p-2 rounded-full text-xs font-bold transition-all shadow-md flex items-center justify-center cursor-pointer',
  logoutButton:
    'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500/80 hover:bg-red-600 backdrop-blur-xl border border-white/40 text-white flex items-center justify-center cursor-pointer shadow-lg transition-all',
  userCard:
    'bg-[#0b2b1d]/90 text-white backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border border-emerald-500/30 flex flex-col justify-between',
};

export const modalStyles = {
  overlay:
    'fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto',
  content:
    'bg-white/95 backdrop-blur-3xl rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-white/80 relative overflow-hidden text-slate-800',
  title: 'text-lg sm:text-xl font-black text-slate-900 mb-1',
  subtitle: 'text-xs text-slate-600 mb-4',
  label: 'block text-xs font-bold text-slate-800 mb-1.5',
  input:
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 mb-3 shadow-inner',
  textarea:
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 mb-3 shadow-inner resize-none h-20',
  btnRow: 'flex items-center justify-end gap-2.5 mt-3',
  cancelBtn:
    'px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer',
  submitBtn:
    'bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer',
};
