import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import logo from '../../assets/logo.png';

const desktopLinkClass = (active) =>
  `h-16 flex items-center px-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm ${
    active
      ? 'text-primary font-bold border-b-2 border-primary'
      : 'text-on-surface-variant hover:text-primary'
  }`;

const mobileLinkClass = (active) =>
  `block w-full text-left px-sm py-xs min-h-[44px] rounded-lg font-body-md text-body-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
    active
      ? 'bg-primary/5 text-primary font-semibold'
      : 'text-on-surface-variant hover:bg-surface-container-low'
  }`;

const Navbar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { role, logoutAdmin, logoutStudent } = useAuth();
  const location = useLocation();
  const menuButtonRef = useRef(null);

  // The mobile menu closes on navigation, and on Escape (focus back to the menu button)
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileOpen]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/timeline', label: 'Timeline' },
  ];

  // Auth-aware links. The admin login is intentionally not linked publicly;
  // /admin/login stays reachable by URL.
  if (role === 'admin') {
    navLinks.push(
      { to: '/admin/dashboard', label: 'Dashboard' },
      { to: '/admin/students', label: 'Students' }
    );
  } else if (role === 'student') {
    navLinks.push(
      { to: '/applications', label: 'My applications' },
      { to: '/profile', label: 'Profile' }
    );
  } else {
    navLinks.push({ to: '/login', label: 'Login' }, { to: '/signup', label: 'Sign up' });
  }

  const logout = role === 'admin' ? logoutAdmin : role === 'student' ? logoutStudent : null;

  const isActive = (path) => location.pathname === path;

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
            <span className="font-headline-md text-headline-md font-semibold hidden sm:block">
              <span className="text-brand-navy">The </span>
              <span className="text-brand-blue">Placement</span>
              <span className="text-brand-navy"> Feed</span>
            </span>
          </Link>
        </div>

        {/* Center zone — desktop nav, truly centered between left and right zones */}
        <nav className="hidden md:flex items-center gap-md" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={desktopLinkClass(isActive(link.to))}
            >
              {link.label}
            </Link>
          ))}
          {logout && (
            <button type="button" onClick={logout} className={desktopLinkClass(false)}>
              Logout
            </button>
          )}
        </nav>

        {/* Right zone — flex-1 balances the logo zone; hamburger sits here on mobile */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <NotificationBell />
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileOpen}
            aria-controls="mobile-menu"
            className="md:hidden p-2 min-w-[44px] min-h-[44px] rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              {isMobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile menu — mirrors the desktop links */}
      {isMobileOpen && (
        <nav id="mobile-menu" className="md:hidden border-t border-outline-variant bg-surface-container-lowest px-sm py-sm space-y-1 animate-menu-in" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileOpen(false)}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={mobileLinkClass(isActive(link.to))}
            >
              {link.label}
            </Link>
          ))}
          {logout && (
            <button
              type="button"
              onClick={() => {
                setIsMobileOpen(false);
                logout();
              }}
              className={mobileLinkClass(false)}
            >
              Logout
            </button>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;
