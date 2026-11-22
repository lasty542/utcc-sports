/**
 * โมดูลกำหนดเส้นทางหลัก (Routing) ของแอปพลิเคชัน แบ่งหน้าสาธารณะ, นักศึกษา และเจ้าหน้าที่พร้อม Lazy Loading
 */
// src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/auth/Login'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const MicrosoftCallback = lazy(() => import('./pages/auth/MicrosoftCallback'));
const GoogleCallback = lazy(() => import('./pages/auth/GoogleCallback'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentHistory = lazy(() => import('./pages/student/History'));
const StudentQRCode = lazy(() => import('./pages/student/QRCode'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
const AdminBorrowLogs = lazy(() => import('./pages/admin/AdminBorrowLogs'));

// ตัวแสดงสถานะกำลังโหลดระหว่างเปลี่ยนหน้าแบบ Lazy Load
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-9 h-9 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// คอมโพเนนต์หลักที่กำหนด Route ทั้งหมดและการป้องกันสิทธิ์แต่ละหน้า
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/microsoft/callback" element={<MicrosoftCallback />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />

            {/* เส้นทางสำหรับนักศึกษา */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/history"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/qrcode"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentQRCode />
                </ProtectedRoute>
              }
            />

            {/* เส้นทางสำหรับเจ้าหน้าที่ */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Inventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/borrow-logs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBorrowLogs />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
