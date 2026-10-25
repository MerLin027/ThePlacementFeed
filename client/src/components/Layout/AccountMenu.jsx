import { useState, useEffect, useRef, useId } from 'react';
import { Link, useLocation } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { dropDown } from '../../utils/motion';
import PresenceGuard from '../PresenceGuard';

const initialsOf = (student) => {
  const name = `${student?.firstName || ''}`.trim();
  return name ? name.slice(0, 1).toUpperCase() : (student?.email || '?').slice(0, 1).toUpperCase();
};

const itemClass =
  'flex items-center gap-sm w-full min-h-[44px] px-sm rounded-xl font-body-md text-body-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The student's avatar in the header: opens a small panel with who is signed in, the profile, a
 * shortcut to changing the password, and Log out. A disclosure (button + panel), closed by Escape
 * (focus goes back to the avatar), a click outside, or moving to another page.
 */
const AccountMenu = ({ student, onLogout }) => {
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

  const name = `${student?.firstName || ''} ${student?.lastName || ''}`.trim();

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Your account"
        className="group/avatar inline-flex items-center justify-center w-[44px] h-[44px] rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary font-label-md text-label-md transition-[box-shadow,scale] duration-200 group-active/avatar:scale-95 ${
            open ? 'ring-4 ring-primary/20' : 'group-hover/avatar:ring-4 group-hover/avatar:ring-primary/10'
          }`}
          aria-hidden="true"
        >
          {initialsOf(student)}
        </span>
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
                  {initialsOf(student)}
                </span>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface truncate">{name || 'Your account'}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{student?.email}</p>
                </div>
              </div>
              <Link to="/profile" onClick={() => setOpen(false)} className={itemClass}>
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person</span>
                Profile
              </Link>
              <Link to="/change-password" onClick={() => setOpen(false)} className={itemClass}>
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">key</span>
                Change password
              </Link>
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
