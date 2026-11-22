/**
 * โมดูลบริการเรียก API ด้านการยืนยันตัวตน, จัดการโปรไฟล์, รีเซ็ตรหัสผ่าน และ Microsoft 365
 */
import api, { getApiBaseUrl } from './api';
import type { User } from '../types';
export type { User };

// 1. กำหนด Response และ Payload Types ให้ชัดเจน
export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
  studentId: string;
  password: string;
  otp?: string;
}

export interface RegisterPayload {
  studentId: string;
  name: string;
  password: string;
  email?: string;
  role?: 'student' | 'admin';
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfilePayload {
  email?: string;
  phone?: string;
}

export interface SetupOtpResponse {
  secret: string;
  otpauthUrl: string;
}

export interface ForgotPasswordResponse {
  emailSent?: boolean;
  message: string;
}

// 2. จัดกลุ่ม Service Object รวมทุกฟังก์ชันของระบบ Authentication
export const authService = {
  // เข้าสู่ระบบ (รองรับทั้งแบบส่งก้อน object หรือแยกตัวแปร)
  async login(studentId: string, password: string, otp?: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { 
      studentId: studentId.trim(), 
      password, 
      otp 
    });
    return data;
  },

  // สมัครสมาชิก (สำหรับเพิ่มผู้ใช้งาน/เจ้าหน้าที่)
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', {
      studentId: payload.studentId.trim(),
      name: payload.name.trim(),
      password: payload.password,
      email: payload.email?.trim() || undefined,
      role: payload.role || 'student',
    });
    return data;
  },

  // ดึงข้อมูลผู้ใช้ปัจจุบันจาก Token (สำหรับเช็ก Session ตอนรีเฟรชหน้าเว็บ)
  async getMe(): Promise<User> {
    const { data } = await api.get<{ user: User } | User>('/auth/me');
    return 'user' in data ? data.user : data;
  },

  // เปลี่ยนรหัสผ่าน (ใช้ในหน้า Settings)
  async changePassword(
    payloadOrCurrent: ChangePasswordPayload | string,
    maybeNew?: string
  ): Promise<{ message: string }> {
    const payload: ChangePasswordPayload =
      typeof payloadOrCurrent === 'string'
        ? { currentPassword: payloadOrCurrent, newPassword: maybeNew || '' }
        : payloadOrCurrent;
    const { data } = await api.post<{ message: string }>('/auth/change-password', payload);
    return data;
  },

  // อัปเดตข้อมูลติดต่อ (อีเมลและเบอร์โทรศัพท์)
  async updateProfile(payload: UpdateProfilePayload): Promise<{ message: string; user: User }> {
    const { data } = await api.patch<{ message: string; user: User }>('/auth/profile', payload);
    return data;
  },

  // ตั้งค่า 2FA / OTP
  async setupOtp(): Promise<SetupOtpResponse> {
    const { data } = await api.post<SetupOtpResponse>('/auth/otp/setup');
    return data;
  },

  // ยืนยันการเปิดใช้งาน 2FA / OTP ด้วยรหัส 6 หลัก
  async verifyOtp(otp: string): Promise<{ otpEnabled: boolean }> {
    const { data } = await api.post<{ otpEnabled: boolean }>('/auth/otp/verify', { otp });
    return data;
  },

  // ปิดใช้งาน 2FA / OTP
  async disableOtp(): Promise<{ otpEnabled: boolean; message: string }> {
    const { data } = await api.post<{ otpEnabled: boolean; message: string }>('/auth/otp/disable');
    return data;
  },

  // ลืมรหัสผ่าน / ขอส่งลิงก์รีเซ็ต
  async requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
    const { data } = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
    return data;
  },

  // ยืนยันตัวตนด้วยอีเมลและรหัสนักศึกษา เพื่อรีเซ็ตรหัสผ่านทันที (ไม่ต้องพึ่งอีเมล)
  async verifyResetIdentity(email: string, studentId: string): Promise<{ success: boolean; token: string; name: string; message: string }> {
    const { data } = await api.post<{ success: boolean; token: string; name: string; message: string }>('/auth/verify-reset-identity', {
      email,
      studentId,
    });
    return data;
  },

  // บันทึกรหัสผ่านใหม่ทันที (Instant Password Reset)
  async instantResetPassword(payload: {
    token?: string;
    email?: string;
    studentId?: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post<{ success: boolean; message: string }>('/auth/instant-reset-password', payload);
    return data;
  },

  // ตั้งรหัสผ่านใหม่ด้วย Token จากอีเมล
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/reset-password', {
      token,
      newPassword,
    });
    return data;
  },

  // ตรวจสอบสถานะการเชื่อมต่อ Google OAuth
  async getGoogleStatus(): Promise<{ configured: boolean; redirectUri: string; demoAvailable: boolean }> {
    const { data } = await api.get<{ configured: boolean; redirectUri: string; demoAvailable: boolean }>('/auth/google/status');
    return data;
  },

  // URL สำหรับเริ่มล็อกอินด้วย Google
  getGoogleLoginUrl(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qs = origin ? `?redirect=${encodeURIComponent(origin)}` : '';
    return `${getApiBaseUrl()}/auth/google${qs}`;
  },

  // ออกจากระบบและล้างสถานะใน sessionStorage และ localStorage
  logout(): void {
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// 3. Export เพื่อความยืดหยุ่นสูงสุด (รองรับทั้งแบบมีปีกกาและไม่มีปีกกา)
export default authService;