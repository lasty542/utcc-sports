/**
 * โมดูลเก็บคลาส Tailwind CSS สำหรับจัดสไตล์หน้าเข้าสู่ระบบ
 */
// src/pages/Login.styles.ts
export const loginStyles = {
  container: "min-h-screen w-full flex items-center justify-center bg-gray-100 p-4 sm:p-6 font-sans overflow-hidden",
  
  // การ์ดหลักครอบทั้งหน้าจอ (โค้งมนมน พรีเมียม)
  mainCard: "w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[650px] border border-gray-100 relative",
  
  // ฝั่งซ้าย (ฟอร์มและข้อความต้อนรับ)
  leftSide: "lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white relative z-10",
  brandLogo: "text-lg font-black tracking-wider text-green-700 uppercase flex items-center gap-2",
  
  headerArea: "my-auto py-6",
  title: "text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight mb-3",
  subtitle: "text-gray-500 text-sm sm:text-base leading-relaxed mb-8",
  
  label: "block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2",
  input: "w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white bg-gray-50/50 transition-all text-gray-800 text-sm",
  
  button: "w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all duration-200 shadow-lg shadow-green-200 mt-6 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer",
  secondaryButton: "w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-2xl transition-all duration-200 mt-3 flex items-center justify-center gap-2 cursor-pointer",
  
  footerArea: "pt-6 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-medium",
  link: "text-green-700 hover:underline font-bold cursor-pointer",

  // ฝั่งขวา (ภาพธรรมชาติสีเขียวโค้งมนสุดพรีเมียม)
  rightSide: "lg:col-span-6 p-4 sm:p-6 bg-gray-50 flex items-center justify-center",
  imageWrapper: "w-full h-full min-h-[400px] lg:min-h-full rounded-[2rem] overflow-hidden relative shadow-inner bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center",
  natureImageBg: "absolute inset-0 w-full h-full object-cover opacity-85 mix-blend-overlay",
  imageOverlayContent: "relative z-10 text-center text-white p-8",
};