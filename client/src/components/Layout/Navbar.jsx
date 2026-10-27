import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../context/auth';
import { PERMISSIONS } from '../../constants/permissions';
import NotificationBell from '../Notifications/NotificationBell';
import AccountMenu from './AccountMenu';
import logo from '../../assets/logo.png';
import { m } from 'motion/react';
import { dropDown, pillSpring } from '../../utils/motion';

// The visible shape of every header control: a slim 36px pill, centred in a 44px hit area
// (inset-y-1), so the pills sit with even space above and below inside the bar
const PILL = 'absolute inset-x-0 inset-y-1 -z-10 rounded-full';
const PILL_BEFORE =
  'before:absolute before:inset-x-0 before:inset-y-1 before:-z-10 before:rounded-full before:transition-colors before:duration-200 focus-visible:outline-hidden focus-visible:before:ring-2 focus-visible:before:ring-primary';

// Desktop: plain text links; the current page gets a soft tinted pill that slides between links
// (Motion layoutId), drawn behind the link's own content. Hover tints the same shape (::before).
const desktopLinkClass = (active) =>
  `relative isolate inline-flex items-center gap-1.5 h-[44px] px-3 xl:px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-control ${PILL_BEFORE} ${
    active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface hover:before:bg-surface-container-low'
  }`;

const mobileLinkClass = (active) =>
  `flex items-center gap-sm w-full text-left px-sm min-h-[48px] rounded-xl font-body-md text-body-md transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
    active
      ? 'bg-primary-fixed/70 text-on-primary-fixed font-semibold'
      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
  }`;

// The frosted look shared by the bar and the bell's circle (blur on ::before, see below)
const FROSTED = 'before:absolute before:inset-0 before:-z-10 before:bg-surface-container-lowest/80 before:backdrop-blur-md before:ring-1 before:ring-[rgb(3_21_54/0.06)] transition-shadow duration-300 shadow-[0_1px_2px_rgb(3_21_54/0.04),0_8px_24px_-12px_rgb(3_21_54/0.12)] data-scrolled:shadow-[0_2px_4px_rgb(3_21_54/0.05),0_14px_32px_-12px_rgb(3_21_54/0.2)]';

// The student's avatar letter: first name, else the email
const initialOf = (student) => {
  const name = `${student?.firstName || ''}`.trim();
  return (name || student?.email || '?').slice(0, 1).toUpperCase();
};

/**
 * The site header: a floating, rounded bar a few pixels below the top of the window, with the
 * dotted background showing around it, and the notification bell in its own round button beside it
 * (so it never crowds the student's avatar). No full-width border line; both are set apart by a
 * near-invisible hairline and a soft shadow that grows a little once the page scrolls.
 * Students and staff log out (and change their password) from the account menu on the right; on
 * phones, from the menu. Staff see the areas their role allows (Setup and Team: super admins).
 */
const Navbar = () => {
  const { student, staff, can, logout } = useAuth();
  const location = useLocation();
  const menuButtonRef = useRef(null);

  // The mobile menu closes for good on any page change (adjusted during render, not in an effect);
  // Escape also closes it (focus back to the menu button)
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [menuShownOn, setMenuShownOn] = useState(location.pathname);
  if (menuShownOn !== location.pathname) {
    setMenuShownOn(location.pathname);
    if (isMobileOpen) setIsMobileOpen(false);
  }

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

  // Account-aware links: staff see the areas their role allows (the server checks them too)
  if (staff) {
    navLinks.push(
      ...[
        can(PERMISSIONS.DRIVES) && { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
        can(PERMISSIONS.STUDENTS) && { to: '/admin/students', label: 'Students', icon: 'group' },
        can(PERMISSIONS.SETUP) && { to: '/admin/settings', label: 'Setup', icon: 'tune' },
        can(PERMISSIONS.STAFF) && { to: '/admin/team', label: 'Team', icon: 'badge' },
      ].filter(Boolean),
      // The account menu holds this on wider screens; phones (no account button) get it in their menu.
      // The super admin changes its password on its profile.
      can(PERMISSIONS.PROFILE)
        ? { to: '/admin/profile', label: 'Profile', icon: 'person', phoneOnly: true }
        : { to: '/change-password', label: 'Change password', icon: 'key', phoneOnly: true }
    );
  } else if (student) {
    // Profile and the password live in the avatar menu; phones (no avatar) get them in their menu
    navLinks.push(
      { to: '/applications', label: 'My Applications', icon: 'work_history' },
      { to: '/profile', label: 'Profile', icon: 'person', phoneOnly: true },
      { to: '/change-password', label: 'Change password', icon: 'key', phoneOnly: true }
    );
  } else {
    navLinks.push({ to: '/login', label: 'Login', icon: 'login' }, { to: '/signup', label: 'Sign up', icon: 'person_add', cta: true });
  }

  const signedIn = Boolean(staff || student);

  const isActive = (path) => location.pathname === path;
  // Already home: the logo and Home link take you back to the top instead of doing nothing
  const onHomeClick = () => {
    if (location.pathname === '/') document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Desktop links are text from lg (xl for the longer admin nav); narrower, they become icons and the
  // label stays as the accessible name
  const desktopLinks = navLinks.filter((link) => !link.cta && !link.phoneOnly);
  const wide = desktopLinks.length > 4;
  const labelClass = wide ? 'sr-only xl:not-sr-only' : 'sr-only lg:not-sr-only';
  const iconClass = wide ? 'xl:hidden' : 'lg:hidden';

  return (
    <header className="sticky top-0 z-50 w-full px-xs sm:px-sm md:px-lg pt-2 md:pt-3 pb-1">
      <div className="mx-auto w-full max-w-container-max flex items-start gap-xs md:gap-sm">
      {/* The blur sits on ::before, not on the bar itself: backdrop-filter on an element makes it the
          containing block of fixed-position children */}
      <div
        data-scrolled={scrolled || undefined}
        className={`relative isolate flex-1 min-w-0 rounded-2xl before:rounded-2xl ${FROSTED}`}
      >
        <div className="flex items-center h-[56px] md:h-[60px] pl-xs pr-1.5 md:pl-sm md:pr-2 gap-sm">

          {/* Left — logo, flex-1 so it balances the right side */}
          <div className="flex-1 flex items-center min-w-0">
            <Link
              to="/"
              onClick={onHomeClick}
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
              <span className="font-headline-sm text-headline-sm font-semibold hidden min-[360px]:block md:hidden lg:block whitespace-nowrap tracking-tight">
                <span className="text-brand-navy">The </span>
                <span className="text-brand-blue">Placement</span>
                <span className="text-brand-navy"> Feed</span>
              </span>
            </Link>
          </div>

          {/* Centre — desktop links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5" aria-label="Main">
            {desktopLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={link.to === '/' ? onHomeClick : undefined}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={desktopLinkClass(isActive(link.to))}
              >
                {isActive(link.to) && (
                  <m.span layoutId="nav-pill" transition={pillSpring} className={`${PILL} bg-primary-fixed/70`} aria-hidden="true" />
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
                className={`group/cta relative isolate ml-2 lg:ml-3 inline-flex items-center h-[44px] px-4 rounded-full font-label-md text-label-md whitespace-nowrap text-on-primary ${PILL_BEFORE} before:bg-primary-container before:shadow-soft hover:before:bg-primary focus-visible:before:ring-offset-2`}
              >
                {link.label}
                <span className="material-symbols-outlined text-[18px] -mr-1 ml-0.5 transition-transform duration-200 ease-out-soft group-hover/cta:translate-x-0.5" aria-hidden="true">arrow_forward</span>
              </Link>
            ))}
          </nav>

          {/* Right — flex-1 balances the logo; the menu button lives here on phones */}
          <div className="flex-1 flex items-center justify-end gap-2">
            {staff && (
              <div className="hidden md:block">
                <AccountMenu
                  label={`${staff.roleLabel || 'Admin'} account`}
                  avatar={<span className="material-symbols-outlined text-[18px]">verified_user</span>}
                  tag={staff.roleLabel || 'Admin'}
                  name={staff.name || (staff.role === 'super_admin' ? 'Super Admin' : 'Admin')}
                  detail={staff.email || staff.username}
                  links={
                    can(PERMISSIONS.PROFILE)
                      ? [{ to: '/admin/profile', label: 'Profile', icon: 'person' }]
                      : [{ to: '/change-password', label: 'Change password', icon: 'key' }]
                  }
                  onLogout={logout}
                />
              </div>
            )}
            {student && (
              <div className="hidden md:block">
                <AccountMenu
                  avatar={initialOf(student)}
                  name={`${student?.firstName || ''} ${student?.lastName || ''}`.trim()}
                  detail={student?.email}
                  links={[
                    { to: '/profile', label: 'Profile', icon: 'person' },
                    { to: '/change-password', label: 'Change password', icon: 'key' },
                  ]}
                  onLogout={logout}
                />
              </div>
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
                onClick={() => {
                  setIsMobileOpen(false);
                  if (link.to === '/') onHomeClick();
                }}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={mobileLinkClass(isActive(link.to))}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            {signedIn && (
              <>
                <div className="h-px mx-sm my-1 bg-outline-variant/70" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    logout();
                  }}
                  className={`${mobileLinkClass(false)} text-error! hover:bg-error-container/50!`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
                  Log out
                </button>
              </>
            )}
          </m.nav>
        )}
      </div>

      {/* The bell, in its own frosted circle beside the bar (same height); its panel opens below it */}
      <div
        data-scrolled={scrolled || undefined}
        className={`relative isolate shrink-0 flex items-center justify-center w-[56px] h-[56px] md:w-[60px] md:h-[60px] rounded-full before:rounded-full ${FROSTED}`}
      >
        <NotificationBell />
      </div>
      </div>
    </header>
  );
};

export default Navbar;
