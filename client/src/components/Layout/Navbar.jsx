import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isAdmin } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/timeline', label: 'Timeline' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900">
              The Placement Feed
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(link.to)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="w-px h-6 bg-slate-200 mx-2" />
            {isAdmin ? (
              <Link
                to="/admin/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive('/admin/dashboard')
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/admin/login"
                className="px-3 py-2 rounded-md text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileOpen && (
          <div className="md:hidden pb-4 border-t border-slate-100 mt-2 pt-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsMobileOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(link.to)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={isAdmin ? '/admin/dashboard' : '/admin/login'}
              onClick={() => setIsMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {isAdmin ? 'Dashboard' : 'Admin'}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
