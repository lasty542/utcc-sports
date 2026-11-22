/**
 * หน้า Callback สำหรับรับ Token จาก Microsoft 365 OAuth แล้วโหลดข้อมูลผู้ใช้เข้าสู่ระบบ
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

// ตรวจสอบ Token ที่ส่งมาจาก URL แล้วบันทึก Session พร้อม Redirect ตาม Role
export default function MicrosoftCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(() =>
    token ? null : 'ไม่พบโทเคนยืนยันตัวตนจาก Microsoft'
  );

  useEffect(() => {
    if (!token) return;

    sessionStorage.setItem('auth_user', JSON.stringify({ user: null, token }));
    localStorage.removeItem('auth_user');

    let active = true;
    authService
      .getMe()
      .then((user) => {
        if (!active) return;
        login(user, token);
        navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true });
      })
      .catch(() => {
        if (!active) return;
        logout();
        setError('ไม่สามารถยืนยันบัญชี Microsoft ได้ กรุณาลองใหม่อีกครั้ง');
      });

    return () => {
      active = false;
    };
  }, [token, login, logout, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl text-center">
        {error ? (
          <div>
            <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
            <h1 className="text-base font-black text-slate-900 mb-1">เข้าสู่ระบบไม่สำเร็จ</h1>
            <p className="text-xs text-slate-500 mb-5">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} /> กลับหน้าเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <div>
            <Loader2 size={36} className="animate-spin text-emerald-600 mx-auto mb-3" />
            <h1 className="text-base font-black text-slate-900 mb-1">กำลังเชื่อมต่อบัญชี Microsoft</h1>
            <p className="text-xs text-slate-500">กรุณารอสักครู่...</p>
          </div>
        )}
      </div>
    </div>
  );
}
