/**
 * คอมโพเนนต์ป้องกันเส้นทาง (Route Guard) ตรวจสอบสถานะล็อกอินและสิทธิ์การเข้าถึงหน้าเว็บ
 */
// src/components/ProtectedRoute.tsx
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

// ตรวจสอบว่าผู้ใช้ล็อกอินแล้วและมี Role ตรงตามที่หน้ากำหนดหรือไม่
export  function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const loading = authContext?.loading ?? false;

  // รอตรวจสอบ token ก่อน
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // ถ้ายังไม่ได้เข้าสู่ระบบ ให้เด้งกลับไปหน้า Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // ถ้าสิทธิ์ของผู้ใช้ไม่อยู่ในกลุ่มที่อนุญาต ให้เด้งไปหน้าแรกของสิทธิ์นั้น
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  // ถ้าผ่านทุกเงื่อนไข ให้แสดงหน้าจอตามปกติ
  return <>{children}</>;
}
