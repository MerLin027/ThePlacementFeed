import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../context/auth';
import NotificationBell from '../Notifications/NotificationBell';
import logo from '../../assets/logo.png';
import { m } from 'motion/react';
import { dropDown, pillSpring } from '../../utils/motion';

// Desktop: links sit in one rounded track; the current page gets a raised white pill that slides
// between links (Motion layoutId), drawn behind the link's own content
const desktopLinkClass = (active) =>
  `relative isolate inline-flex items-center gap-1.5 h-[44px] px-3.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
    active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/70'
  }`;

const mobileLinkClass = (active) =>
  `flex items-center gap-sm w-full text-left px-sm min-h-[48px] rounded-xl font-body-md text-body-md transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
    active
      ? 'bg-primary-fixed text-on-primary-fixed font-semibold'
      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
  }`;

const initialsOf = (student) => {
  const name = `${student?.firstName || ''}`.trim();
  return name ? name.slice(0, 1).toUpperCase() : (student?.email || '?').slice(0, 1).toUpperCase();
};

const Navbar = () => {
  const { role, student, logoutAdmin, logoutStudent } = useAuth();
  const location = useLocation();
  const menuButtonRef = useRef(null);

  // The mobile menu remembers the page it was opened on, so navigating closes it without an
  // effect; Escape also closes it (focus back to the menu button)
  const [menuOpenOn, setMenuOpenOn] = useState(null);
  const isMobileOpen = menuOpenOn === location.pathname;
  const setIsMobileOpen = (open) => setMenuOpenOn(open ? location.pathname : null);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpenOn(null);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileOpen]);

  // A soft shadow appears once the page (the <main> scroller) has moved
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return undefined;
    const onScroll = () => setScrolled(main.scrollTop > 4);
    onScroll();
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { to: '/', label: 'Home', icon: 'home' },
    { to: '/timeline', label: 'Timeline', icon: 'timeline' },
  ];

  // Auth-aware links. The admin login is intentionally not linked publicly;
  // /admin/login stays reachable by URL.
  if (role === 'admin') {
    navLinks.push(
      { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/admin/students', label: 'Students', icon: 'group' },
      { to: '/admin/settings', label: 'Settings', icon: 'settings' }
    );
  } else if (role === 'student') {
    navLinks.push(
      { to: '/applications', label: 'My applications', icon: 'work_history' },
      { to: '/profile', label: 'Profile', icon: 'person' }
    );
  } else {
    navLinks.push({ to: '/login', label: 'Login', icon: 'login' }, { to: '/signup', label: 'Sign up', icon: 'person_add', cta: true });
  }

  const logout = role === 'admin' ? logoutAdmin : role === 'student' ? logoutStudent : null;

  const isActive = (path) => location.pathname === path;
  // Labels show from lg (xl for the longer admin nav); below that the links are icons, and the label
  // stays as the accessible name
  const labelClass = navLinks.length > 4 ? 'sr-only xl:not-sr-only' : 'sr-only lg:not-sr-only';

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="relative isolate w-full sticky top-0 z-50 transition-shadow duration-200 data-scrolled:shadow-soft before:absolute before:inset-0 before:-z-10 before:bg-surface/80 before:backdrop-blur-md after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-transparent after:via-primary-30 after:to-transparent"
    >
      {/* The blur lives on ::before, not on <header>: backdrop-filter on the header itself would
          become the containing block of fixed-position children (notification panel, menus) */}
      <div className="flex items-center w-full px-sm md:px-lg h-16 gap-sm">

        {/* Left zone — logo, flex-1 so it balances the right zone */}
        <div className="flex-1 flex items-center min-w-0">
          <Link
            to="/"
            aria-label="The Placement Feed — home"
            className="group/logo flex items-center gap-xs min-h-[44px] rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src={logo}
              alt=""
              width={90}
              height={108}
              className="h-9 w-auto object-contain transition-transform duration-300 ease-out-soft group-hover/logo:-rotate-6 group-hover/logo:scale-105"
            />
            <span className="font-headline-md text-headline-md font-semibold hidden sm:block md:hidden lg:block whitespace-nowrap">
              <span className="text-brand-navy">The </span>
              <span className="text-brand-blue bg-linear-to-r from-brand-blue to-[#0ea5e9] bg-clip-text [-webkit-text-fill-color:transparent]">Placement</span>
              <span className="text-brand-navy"> Feed</span>
            </span>
          </Link>
        </div>

        {/* Center zone — desktop nav in one rounded track */}
        <nav
          className="hidden md:flex items-center gap-1 p-1 rounded-full bg-surface-container-low/80 border border-outline-variant shadow-xs"
          aria-label="Main"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={
                link.cta
                  ? 'inline-flex items-center gap-1.5 h-[44px] px-4 rounded-full font-label-md text-label-md whitespace-nowrap bg-primary-container text-on-primary shadow-soft hover:bg-primary hover:shadow-lift transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                  : desktopLinkClass(isActive(link.to))
              }
            >
              {isActive(link.to) && !link.cta && (
                <m.span layoutId="nav-pill" transition={pillSpring} className="absolute inset-0 -z-10 rounded-full bg-surface-container-lowest shadow-soft" aria-hidden="true" />
              )}
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{link.icon}</span>
              <span className={link.cta ? '' : labelClass}>{link.label}</span>
            </Link>
          ))}
          {logout && (
            <button type="button" onClick={logout} title="Logout" className={`${desktopLinkClass(false)} hover:text-error!`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
              <span className={labelClass}>Logout</span>
            </button>
          )}
        </nav>

        {/* Right zone — flex-1 balances the logo zone; hamburger sits here on mobile */}
        <div className="flex-1 flex items-center justify-end gap-2">
          {role === 'admin' && (
            <span className="hidden xl:inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-brand-navy text-white font-label-sm text-label-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">verified_user</span>
              Admin
            </span>
          )}
          <NotificationBell />
          {role === 'student' && (
            <Link
              to="/profile"
              aria-label="Your profile"
              title="Your profile"
              className="hidden md:inline-flex items-center justify-center w-[44px] h-[44px] rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-linear-to-br from-brand-blue to-[#7c3aed] text-white font-label-md text-label-md shadow-soft ring-2 ring-surface-container-lowest"
                aria-hidden="true"
              >
                {initialsOf(student)}
              </span>
            </Link>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileOpen}
            aria-controls="mobile-menu"
            className="md:hidden p-2 min-w-[44px] min-h-[44px] rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              {isMobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile menu — mirrors the desktop links */}
      {/* Enters with a short drop; leaves at once (a dismissed menu must be gone immediately) */}
      {isMobileOpen && (
        <m.nav
          initial={dropDown.initial}
          animate={dropDown.animate}
          transition={dropDown.transition}
          id="mobile-menu"
          className="md:hidden border-t border-outline-variant bg-surface-container-lowest/95 px-sm py-sm space-y-1 shadow-lift"
          aria-label="Main"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileOpen(false)}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={mobileLinkClass(isActive(link.to))}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{link.icon}</span>
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
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
              Logout
            </button>
          )}
        </m.nav>
      )}
    </header>
  );
};

export default Navbar;
