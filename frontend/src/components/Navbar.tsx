/**
 * คอมโพเนนต์แถบนำทางด้านบน แสดงเมนูตามสิทธิ์ผู้ใช้ (นักศึกษา/เจ้าหน้าที่) และปุ่มออกจากระบบ
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// แถบเมนูนำทางรองรับทั้งหน้าจอ Desktop และ Mobile
export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ออกจากระบบและพากลับไปหน้าเข้าสู่ระบบ
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const studentLinks = [
    { to: '/student', label: 'อุปกรณ์' },
    { to: '/student/history', label: 'ประวัติ' },
    { to: '/student/qrcode', label: 'QR Code' },
  ];

  const adminLinks = [
    { to: '/admin', label: 'สแกน QR' },
    { to: '/admin/inventory', label: 'คลังอุปกรณ์' },
    { to: '/admin/borrow-logs', label: 'ประวัติการยืม-คืน' },
  ];

  const links = user?.role === 'admin' ? adminLinks : studentLinks;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">🏅 ระบบยืม-คืน</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Info & Logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={16} />
              <span>{user?.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                user?.role === 'admin'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {user?.role === 'admin' ? 'เจ้าหน้าที่' : 'นักศึกษา'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              ออก
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-gray-600 hover:bg-gray-50"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 mt-2">
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600">
                <User size={16} />
                <span>{user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
