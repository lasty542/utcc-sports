/**
 * โมดูลตั้งค่า Axios Instance กลางสำหรับเรียก Backend API พร้อมแนบ Token อัตโนมัติ
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: ดึง Token จาก localStorage แล้วใส่ใน Header อัตโนมัติ
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token: string | undefined = parsed?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // ignore parse errors
  }
  return config;
});

// Interceptor: ถ้า 401 ให้ลบ token แล้วเด้งไปหน้า login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_user');
      // ไม่ redirect อัตโนมัติที่นี่ — ให้ AuthContext จัดการ
    }
    return Promise.reject(error);
  },
);

export default api;
