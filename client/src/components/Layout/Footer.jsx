import logo from '../../assets/logo.png';
import charusatLogo from '../../assets/charusat-logo.png';
import cdpcLogo from '../../assets/cdpc-logo.png';

// Computed once per page load, not on every render (React components must render purely)
const YEAR = new Date().getFullYear();

/**
 * The site footer, at the end of every page (inside the <main> scroller, so it scrolls in after the
 * content rather than staying on screen). One slim rounded bar, the header's height and look:
 * brand and copyright, a short line about the site (centred: equal side columns), the CHARUSAT
 * and CDPC logos.
 * On phones it stacks, centred.
 */
const Footer = () => (
  <footer className="shrink-0 w-full px-xs sm:px-sm md:px-lg pt-md pb-2 md:pb-3">
    {/* The blur sits on ::before, as in the header */}
    <div className="relative isolate mx-auto w-full max-w-container-max rounded-2xl shadow-[0_1px_2px_rgb(3_21_54/0.04),0_8px_24px_-12px_rgb(3_21_54/0.12)] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-surface-container-lowest/80 before:backdrop-blur-md before:ring-1 before:ring-[rgb(3_21_54/0.06)]">
      <div className="flex flex-col items-center gap-y-2 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-md px-sm md:px-md py-sm md:py-0 md:h-[60px]">
        <p className="order-3 md:order-none flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">
          <img src={logo} alt="" width={90} height={108} className="h-5 w-auto object-contain" />
          <span>© {YEAR} The Placement Feed</span>
        </p>

        <p className="font-body-sm text-body-sm text-outline text-center">
          Every CHARUSAT placement drive, in one place.
        </p>

        {/* Logos at one visual height; the width caps keep CHARUSAT's wide mark in check */}
        <div className="flex items-center gap-sm md:justify-self-end">
          <img
            src={charusatLogo}
            alt="CHARUSAT — Charotar University of Science and Technology"
            className="h-5 w-auto max-w-28 object-contain"
          />
          <span className="h-5 w-px bg-outline-variant" aria-hidden="true" />
          <img
            src={cdpcLogo}
            alt="CDPC — Career Development and Placement Cell"
            className="h-8 w-auto max-w-28 object-contain"
          />
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
