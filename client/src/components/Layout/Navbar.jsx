import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../context/auth';
import NotificationBell from '../Notifications/NotificationBell';
import logo from '../../assets/logo.png';
import { m } from 'motion/react';
import { dropDown, pillSpring } from '../../utils/motion';

// Desktop: plain text links; the current page gets a soft tinted pill that slides between links
// (Motion layoutId), drawn behind the link's own content
const desktopLinkClass = (active) =>
  `relative isolate inline-flex items-center gap-1.5 h-[44px] px-3 rounded-xl font-label-md text-label-md whitespace-nowrap transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
    active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
  }`;

const mobileLinkClass = (active) =>
  `flex items-center gap-sm w-full text-left px-sm min-h-[48px] rounded-xl font-body-md text-body-md transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
    active
      ? 'bg-primary-fixed/70 text-on-primary-fixed font-semibold'
      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
  }`;

const initialsOf = (student) => {
  const name = `${student?.firstName || ''}`.trim();
  return name ? name.slice(0, 1).toUpperCase() : (student?.email || '?').slice(0, 1).toUpperCase();
};

/**
 * The site header: one floating, rounded bar a few pixels below the top of the window, with the
 * dotted background showing around it. No full-width border line; the bar is set apart by a
 * near-invisible hairline and a soft shadow that grows a little once the page scrolls.
 */
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

  // The bar's shadow deepens a little once the page (the <main> scroller) has moved
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
  // Desktop links are text from lg (xl for the longer admin nav); narrower, they become icons and the
  // label stays as the accessible name
  const wide = navLinks.length > 4;
  const labelClass = wide ? 'sr-only xl:not-sr-only' : 'sr-only lg:not-sr-only';
  const iconClass = wide ? 'xl:hidden' : 'lg:hidden';

  return (
    <header className="sticky top-0 z-50 w-full px-xs sm:px-sm md:px-lg pt-2 md:pt-3 pb-1">
      {/* The blur sits on ::before, not on the bar itself: backdrop-filter on an element makes it the
          containing block of fixed-position children */}
      <div
        data-scrolled={scrolled || undefined}
        className="relative isolate mx-auto w-full max-w-container-max rounded-2xl transition-shadow duration-300 shadow-[0_1px_2px_rgb(3_21_54/0.04),0_8px_24px_-12px_rgb(3_21_54/0.12)] data-scrolled:shadow-[0_2px_4px_rgb(3_21_54/0.05),0_14px_32px_-12px_rgb(3_21_54/0.2)] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-surface-container-lowest/80 before:backdrop-blur-md before:ring-1 before:ring-[rgb(3_21_54/0.06)]"
      >
        <div className="flex items-center h-[56px] md:h-[60px] pl-xs pr-1.5 md:pl-sm md:pr-2 gap-sm">

          {/* Left — logo, flex-1 so it balances the right side */}
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
                className="h-8 w-auto object-contain transition-transform duration-300 ease-out-soft group-hover/logo:-rotate-6"
              />
              <span className="font-headline-sm text-headline-sm font-semibold hidden sm:block md:hidden lg:block whitespace-nowrap tracking-tight">
                <span className="text-brand-navy">The </span>
                <span className="text-brand-blue">Placement</span>
                <span className="text-brand-navy"> Feed</span>
              </span>
            </Link>
          </div>

          {/* Centre — desktop links */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main">
            {navLinks.filter((link) => !link.cta).map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={desktopLinkClass(isActive(link.to))}
              >
                {isActive(link.to) && (
                  <m.span layoutId="nav-pill" transition={pillSpring} className="absolute inset-0 -z-10 rounded-xl bg-primary-fixed/70" aria-hidden="true" />
                )}
                {/* Label first in the markup (the icon's ligature text, e.g. "dashboard", must not be the
                    first match for the link's name); the icon is shown first with CSS order */}
                <span className={labelClass}>{link.label}</span>
                <span className={`material-symbols-outlined text-[20px] order-first ${iconClass}`} aria-hidden="true">{link.icon}</span>
              </Link>
            ))}
            {navLinks.filter((link) => link.cta).map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className="ml-1 inline-flex items-center gap-1.5 h-[44px] px-4 rounded-xl font-label-md text-label-md whitespace-nowrap bg-primary-container text-on-primary shadow-soft hover:bg-primary transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {link.label}
              </Link>
            ))}
            {logout && (
              <button type="button" onClick={logout} title="Logout" className={`${desktopLinkClass(false)} hover:text-error!`}>
                <span className={labelClass}>Logout</span>
                <span className={`material-symbols-outlined text-[20px] order-first ${iconClass}`} aria-hidden="true">logout</span>
              </button>
            )}
          </nav>

          {/* Right — flex-1 balances the logo; the menu button lives here on phones */}
          <div className="flex-1 flex items-center justify-end gap-1">
            {role === 'admin' && (
              <span className="hidden xl:inline-flex items-center gap-1 h-7 px-2.5 mr-1 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
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
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary font-label-md text-label-md"
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
              className="md:hidden p-2 min-w-[44px] min-h-[44px] rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                {isMobileOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu — opens inside the same bar; enters with a short drop and leaves at once
            (a dismissed menu must be gone immediately) */}
        {isMobileOpen && (
          <m.nav
            initial={dropDown.initial}
            animate={dropDown.animate}
            transition={dropDown.transition}
            id="mobile-menu"
            className="md:hidden px-xs pb-xs pt-1 space-y-1"
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
      </div>
    </header>
  );
};

export default Navbar;
