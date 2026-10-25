import { useState, useEffect, useRef, useId } from 'react';
import { Link, useLocation } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { dropDown } from '../../utils/motion';
import PresenceGuard from '../PresenceGuard';

const itemClass =
  'flex items-center gap-sm w-full min-h-[44px] px-sm rounded-xl font-body-md text-body-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The account button in the header (the student's avatar, the admin's badge): opens a small panel
 * with who is signed in, the account links, and Log out. A disclosure (button + panel), closed by
 * Escape (focus goes back to the button), a click outside, or moving to another page.
 *
 * `avatar` is what the round badge shows (an initial or an icon); `tag` is an optional word shown
 * beside it on wide screens (e.g. "Admin").
 */
const AccountMenu = ({ label = 'Your account', avatar, tag, name, detail, links, onLogout }) => {
  const { pathname } = useLocation();
  const panelId = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  // Any page change closes it for good (adjusted during render, not in an effect)
  const [shownOn, setShownOn] = useState(pathname);
  if (shownOn !== pathname) {
    setShownOn(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        className={`group/avatar inline-flex items-center justify-center gap-1.5 min-w-[44px] h-[44px] rounded-full transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
          tag ? `xl:pl-1.5 xl:pr-2.5 ${open ? 'xl:bg-surface-container-low' : 'xl:hover:bg-surface-container-low'}` : ''
        }`}
      >
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary font-label-md text-label-md transition-[box-shadow,scale] duration-200 group-active/avatar:scale-95 ${
            open ? 'ring-4 ring-primary/20' : 'group-hover/avatar:ring-4 group-hover/avatar:ring-primary/10'
          }`}
          aria-hidden="true"
        >
          {avatar}
        </span>
        {tag && (
          <span className="hidden xl:inline-flex items-center gap-0.5 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant group-hover/avatar:text-on-surface" aria-hidden="true">
            {tag}
            <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ease-out-soft ${open ? 'rotate-180' : ''}`}>expand_more</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            key="account"
            id={panelId}
            {...dropDown}
            className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1rem)] p-1.5 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-pop origin-top-right z-50"
          >
            <PresenceGuard>
              <div className="flex items-center gap-sm px-sm py-xs mb-1">
                <span className="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-primary-container text-on-primary font-label-md text-label-md" aria-hidden="true">
                  {avatar}
                </span>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface truncate">{name || label}</p>
                  {detail && <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{detail}</p>}
                </div>
              </div>
              {links.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setOpen(false)} className={itemClass}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-outline-variant/70" aria-hidden="true" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className={`${itemClass} text-error! hover:bg-error-container/50!`}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
                Log out
              </button>
            </PresenceGuard>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountMenu;
