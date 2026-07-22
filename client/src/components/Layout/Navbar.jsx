import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';

const Navbar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isAdmin } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/timeline', label: 'Timeline' },
  ];

  const isActive = (path) => location.pathname === path;

  // Auth-aware admin link
  const adminTo = isAdmin ? '/admin/dashboard' : '/admin/login';
  const adminLabel = isAdmin ? 'Dashboard' : 'Login';

  return (
    <header className="bg-surface border-b border-outline-variant w-full sticky top-0 z-50">
      <div className="flex items-center w-full px-sm md:px-lg h-16">

        {/* Left zone — logo, flex-1 so it balances the right zone */}
        <div className="flex-1 flex items-center">
          <Link to="/" className="flex items-center gap-xs">
            <img
              src={logo}
              alt="The Placement Feed"
              className="h-9 w-auto object-contain"
            />
            <span className="font-headline-md text-headline-md font-semibold text-primary hidden sm:block">
              The Placement Feed
            </span>
          </Link>
        </div>

        {/* Center zone — desktop nav, truly centered between left and right zones */}
        <nav className="hidden md:flex items-center gap-md">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`h-16 flex items-center px-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm ${
                isActive(link.to)
                  ? 'text-primary font-bold border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to={adminTo}
            className={`h-16 flex items-center px-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm ${
              isActive(adminTo)
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            {adminLabel}
          </Link>
        </nav>

        {/* Right zone — flex-1 balances the logo zone; hamburger sits here on mobile */}
        <div className="flex-1 flex items-center justify-end">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">
              {isMobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile menu — Home, Timeline, Login / Dashboard */}
      {isMobileOpen && (
        <div className="md:hidden border-t border-outline-variant bg-surface-container-lowest px-sm py-sm space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileOpen(false)}
              className={`block px-sm py-xs rounded-lg font-body-md text-body-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                isActive(link.to)
                  ? 'bg-primary/5 text-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to={adminTo}
            onClick={() => setIsMobileOpen(false)}
            className={`block px-sm py-xs rounded-lg font-body-md text-body-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
              isActive(adminTo)
                ? 'bg-primary/5 text-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {adminLabel}
          </Link>
        </div>
      )}
    </header>
  );
};

export default Navbar;
