/**
 * โมดูลนิยาม Type / Interface กลางของข้อมูลผู้ใช้งานที่ใช้ร่วมกันทั่วทั้ง Frontend
 */
export interface User {
  id: string | number;
  studentId: string;
  role: 'student' | 'admin';
  name: string;
  email?: string | null;
  phone?: string | null;
  authProvider?: string;
  otpEnabled?: boolean;
}
