import { Link } from 'react-router';
import { useAuth } from '../../context/auth';
import logo from '../../assets/logo.png';
import charusatLogo from '../../assets/charusat-logo.png';
import cdpcLogo from '../../assets/cdpc-logo.png';

// Computed once per page load, not on every render (React components must render purely)
const YEAR = new Date().getFullYear();

const linkClass =
  'inline-flex items-center min-h-[32px] rounded-md font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary';

const accountLinks = {
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/students', label: 'Students' },
    { to: '/admin/settings', label: 'Settings' },
  ],
  student: [
    { to: '/applications', label: 'My applications' },
    { to: '/profile', label: 'Profile' },
  ],
  guest: [
    { to: '/login', label: 'Login' },
    { to: '/signup', label: 'Sign up' },
  ],
};

const LinkColumn = ({ title, links }) => (
  <div>
    <h2 className="font-label-sm text-label-sm uppercase tracking-wider text-outline mb-1">{title}</h2>
    <ul>
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to} className={linkClass}>{link.label}</Link>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * The site footer, at the end of every page (inside the <main> scroller, so it scrolls in after the
 * content rather than staying on screen). Same look as the header: a rounded bar on the dotted
 * background, set apart by a near-invisible hairline and a soft shadow, with no full-width line.
 */
const Footer = () => {
  const { role } = useAuth();

  const backToTop = () => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <footer className="shrink-0 w-full px-xs sm:px-sm md:px-lg pt-lg pb-2 md:pb-3">
      {/* The blur sits on ::before, as in the header */}
      <div className="relative isolate mx-auto w-full max-w-container-max rounded-2xl shadow-[0_1px_2px_rgb(3_21_54/0.04),0_8px_24px_-12px_rgb(3_21_54/0.12)] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-surface-container-lowest/80 before:backdrop-blur-md before:ring-1 before:ring-[rgb(3_21_54/0.06)]">
        <div className="grid gap-md md:grid-cols-[1.4fr_1fr_auto] md:gap-lg px-sm md:px-md pt-md pb-sm">
          {/* Brand */}
          <div className="min-w-0">
            <Link
              to="/"
              aria-label="The Placement Feed — home"
              className="inline-flex items-center gap-xs rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img src={logo} alt="" width={90} height={108} className="h-7 w-auto object-contain" />
              <span className="font-headline-sm text-headline-sm font-semibold whitespace-nowrap tracking-tight">
                <span className="text-brand-navy">The </span>
                <span className="text-brand-blue">Placement</span>
                <span className="text-brand-navy"> Feed</span>
              </span>
            </Link>
            <p className="mt-xs max-w-[24rem] font-body-sm text-body-sm text-on-surface-variant">
              Every CHARUSAT CDPC placement drive in one place: who is hiring, what it pays, who can apply and when applications close.
            </p>
          </div>

          {/* Links */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-sm">
            <LinkColumn title="Explore" links={[{ to: '/', label: 'Drives' }, { to: '/timeline', label: 'Timeline' }]} />
            <LinkColumn title={role ? 'Your account' : 'Account'} links={accountLinks[role] || accountLinks.guest} />
          </nav>

          {/* Logos: the same height so they sit as peers; the width caps keep CHARUSAT's wide mark in check */}
          <div className="flex items-center md:items-start md:justify-end gap-md">
            <img
              src={charusatLogo}
              alt="CHARUSAT — Charotar University of Science and Technology"
              className="h-6 w-auto max-w-32 object-contain"
            />
            <span className="h-6 w-px bg-outline-variant" aria-hidden="true" />
            <img
              src={cdpcLogo}
              alt="CDPC — Career Development and Placement Cell"
              className="h-9 w-auto max-w-32 object-contain -my-1.5"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-xs mx-sm md:mx-md py-xs border-t border-[rgb(3_21_54/0.06)]">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            © {YEAR} The Placement Feed.<span className="hidden sm:inline"> All rights reserved.</span>
          </p>
          <button
            type="button"
            onClick={backToTop}
            className="group/top inline-flex items-center gap-1 min-h-[44px] -mr-2 px-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            Back to top
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200 ease-out-soft group-hover/top:-translate-y-0.5" aria-hidden="true">arrow_upward</span>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
