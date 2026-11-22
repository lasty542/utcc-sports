/**
 * React Context สำหรับจัดการสถานะการเข้าสู่ระบบ, Token ใน sessionStorage และการตรวจสอบ Session อัตโนมัติ (แยกแท็บอิสระ)
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode, useContext, useCallback } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token?: string) => void;
  setUser: (userData: User) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// อ่านข้อมูลผู้ใช้และ JWT Token ที่บันทึกไว้ใน sessionStorage (แยกแท็บอิสระ ไม่ทับกันระหว่างแท็บ)
function loadStoredAuth(): { user: User | null; token: string | null } {
  try {
    const raw = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      // หากพบข้อมูลเก่าใน localStorage ให้คัดลอกมาลง sessionStorage แล้วเคลียร์ของเดิม
      if (!sessionStorage.getItem('auth_user')) {
        sessionStorage.setItem('auth_user', raw);
        localStorage.removeItem('auth_user');
      }
      return { user: parsed.user ?? null, token: parsed.token ?? null };
    }
  } catch { /* ignore */ }
  return { user: null, token: null };
}

// Provider ที่กระจาย state ผู้ใช้, ฟังก์ชัน login และ logout ให้ทั้งแอปพลิเคชัน
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => loadStoredAuth().user);
  const [token, setToken] = useState<string | null>(() => loadStoredAuth().token);
  const [loading, setLoading] = useState(() => Boolean(loadStoredAuth().token));

  // บันทึกข้อมูลผู้ใช้และ Token ลง State และ sessionStorage เมื่อเข้าสู่ระบบสำเร็จ
  const login = useCallback((userData: User, newToken?: string) => {
    setUser(userData);
    const t = newToken ?? token;
    if (newToken) setToken(newToken);
    sessionStorage.setItem('auth_user', JSON.stringify({ user: userData, token: t }));
    localStorage.removeItem('auth_user');
  }, [token]);

  const setUserData = useCallback((userData: User) => {
    setUser(userData);
    const raw = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
    let currentToken = token;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) currentToken = parsed.token;
      } catch { /* ignore */ }
    }
    sessionStorage.setItem('auth_user', JSON.stringify({ user: userData, token: currentToken }));
  }, [token]);

  // ล้างข้อมูลผู้ใช้และ Token ออกจากระบบเมื่อออกจากระบบ
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('auth_user');
    localStorage.removeItem('auth_user');
  }, []);

  // ตรวจสอบ Token ตอนโหลดแอพ
  useEffect(() => {
    let isMounted = true;
    const stored = loadStoredAuth();
    
    if (!stored.token) {
      return;
    }

    authService.getMe()
      .then((freshUser) => {
        if (isMounted) {
          setUser(freshUser);
          sessionStorage.setItem('auth_user', JSON.stringify({ user: freshUser, token: stored.token }));
        }
      })
      .catch(() => {
        if (isMounted) logout();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, setUser: setUserData, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook สำหรับเรียกใช้ข้อมูลและฟังก์ชันการยืนยันตัวตนจาก AuthContext
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}