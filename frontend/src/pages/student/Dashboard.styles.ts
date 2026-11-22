/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับจัดสไตล์หน้าแดชบอร์ดนักศึกษาและ Modal ยืมอุปกรณ์
 */
// src/pages/Student/Dashboard.styles.ts
export const dashboardStyles = {
  container:
    'min-h-screen bg-[#89a9ba] bg-cover bg-center bg-fixed font-sans pb-28 relative overflow-x-hidden text-slate-900',
  bgGlowOverlay:
    'fixed inset-0 bg-gradient-to-b from-sky-900/15 via-emerald-950/10 to-emerald-950/35 pointer-events-none z-0',

  contentWrapper: 'relative z-10 max-w-7xl mx-auto px-4 sm:px-7 pt-5',

  // iPadOS Top Floating Bar
  headerNavbar:
    'flex flex-wrap items-center justify-between gap-3 mb-7',
  brandLogo: 'text-lg sm:text-xl font-black tracking-tight uppercase text-slate-900',
  warningBadge:
    'hidden sm:inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-900 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase',

  menuBtn:
    'bg-white/30 hover:bg-white/45 backdrop-blur-2xl backdrop-saturate-150 text-white border border-white/45 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all shadow-lg flex items-center gap-1.5 cursor-pointer',
  userStatsPill:
    'hidden md:flex items-center gap-2 bg-white/75 backdrop-blur-2xl backdrop-saturate-150 border border-white/80 text-xs font-bold px-4 py-2 rounded-full shadow-lg text-slate-800',

  bentoMainGrid: 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 mb-8',

  // Cream Editorial Card (inspired by Dsgners)
  heroCard:
    'md:col-span-5 bg-[#f6e3ba]/95 backdrop-blur-2xl rounded-[2.2rem] p-6 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.16)] border border-white/70 flex flex-col justify-between relative overflow-hidden text-slate-900',
  heroTitle:
    'text-3xl sm:text-5xl font-black tracking-tight mb-2 text-slate-900 uppercase leading-none',
  heroSubtitle: 'text-slate-700 text-xs sm:text-sm leading-relaxed font-medium',

  // Frosted Glass Bento Boxes (inspired by iPadOS Rooms)
  actionBoxGreen:
    'bg-white/25 hover:bg-white/35 backdrop-blur-2xl backdrop-saturate-150 rounded-[2rem] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.14)] border border-white/45 cursor-pointer transition-all text-white',
  actionBoxLight:
    'bg-[#ff5722]/95 hover:bg-[#ff5722] backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_16px_40px_rgba(255,87,34,0.28)] border border-white/30 cursor-pointer transition-all text-white',

  searchBoxCard:
    'bg-white/78 backdrop-blur-2xl backdrop-saturate-150 rounded-[2rem] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] border border-white/80',
  searchInput:
    'w-full pl-9 pr-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-full text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner',

  graphicCardSide:
    'relative h-40 rounded-[2rem] overflow-hidden shadow-[0_16px_40px_rgba(15,23,42,0.18)] border border-white/50 group cursor-pointer',

  sectionHeader:
    'bg-white/25 backdrop-blur-2xl backdrop-saturate-150 px-5 sm:px-6 py-4 rounded-[2rem] border border-white/45 shadow-[0_16px_40px_rgba(15,23,42,0.12)] mb-6 space-y-3',
  sectionTitle: 'text-base sm:text-lg font-black text-white drop-shadow-sm flex items-center gap-2',

  // iPadOS Squircle Catalog Cards
  equipmentGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5',
  equipmentCard:
    'bg-white/72 hover:bg-white/88 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] shadow-[0_18px_42px_rgba(15,23,42,0.14)] border border-white/80 transition-all duration-300 hover:shadow-[0_24px_54px_rgba(15,23,42,0.22)] hover:-translate-y-1 flex flex-col justify-between overflow-hidden h-full relative cursor-pointer',
  equipmentImageWrapper:
    'p-5 pb-4 relative flex flex-col items-center w-full flex-1 justify-start',
  equipmentContent: 'px-5 pb-5 pt-0 flex flex-col w-full z-10',
  actionBtn:
    'w-full bg-slate-900 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs',

  filterContainer: 'relative',
  dropdownToggleBtn:
    'bg-white/80 hover:bg-white text-slate-900 px-5 py-2.5 rounded-full font-black text-xs shadow-md border border-white/80 flex items-center gap-3 cursor-pointer transition-all',
  dropdownMenu:
    'absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white py-2 z-30',
  dropdownItem:
    'w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 transition-colors cursor-pointer',
};

export const modalStyles = {
  overlay:
    'fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto',
  content:
    'bg-white/72 backdrop-blur-3xl backdrop-saturate-150 rounded-[2.4rem] p-6 sm:p-8 max-w-lg w-full shadow-[0_28px_70px_rgba(15,23,42,0.28)] border border-white/80 ring-1 ring-white/50 relative overflow-hidden text-slate-800',
  title: 'text-xl font-black text-slate-900 mb-1',
  subtitle: 'text-xs text-slate-600 mb-6',
  label: 'block text-xs font-bold text-slate-800 mb-2',
  input:
    'w-full bg-white/75 border border-white/80 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 mb-4 shadow-inner',
  textarea:
    'w-full bg-white/75 border border-white/80 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 mb-4 shadow-inner resize-none h-24',
  btnRow: 'flex items-center justify-end gap-3 mt-4',
  cancelBtn:
    'px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white/60 hover:bg-white/90 border border-white/70 transition-all cursor-pointer',
  submitBtn:
    'bg-slate-900 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all cursor-pointer',
};
