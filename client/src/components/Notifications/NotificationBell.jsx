import { useState, useRef, useEffect, useId } from 'react';
import { Link } from 'react-router';
import { useNotifications } from '../../context/NotificationContext';
import { describeNotification, timeAgo } from '../../utils/notificationText';

const TONE_ICON = {
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-primary-fixed text-on-primary-fixed',
  neutral: 'bg-surface-container-high text-on-surface-variant',
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAllAsRead, clearAll, dismissNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();

  const close = (returnFocus = false) => {
    setIsOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Close on outside click/tap and on Escape (focus goes back to the bell)
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) markAllAsRead();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="material-symbols-outlined text-[24px]" aria-hidden="true">notifications</span>
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error tabular-nums"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-88 max-w-[calc(100vw-1rem)] bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-pop z-50 origin-top-right animate-menu-in flex flex-col max-h-[80vh]"
        >
          <div className="flex items-center justify-between gap-sm px-sm py-xs border-b border-outline-variant">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Notifications</h2>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="min-h-[44px] px-2 rounded-lg text-primary hover:bg-primary/5 font-label-md text-label-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 content-scrollbar">
            {notifications.length === 0 ? (
              <div className="px-md py-lg text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] opacity-50" aria-hidden="true">done_all</span>
                <p className="font-body-md text-body-md mt-xs">You&apos;re all caught up</p>
                <p className="font-body-sm text-body-sm">New drives and updates will show up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {notifications.map((n) => {
                  const { text, icon, tone } = describeNotification(n);
                  return (
                    <li key={n.id} className="relative flex items-stretch hover:bg-surface-container-low transition-colors duration-200">
                      <Link
                        to={`/placement/${n.placementId}`}
                        onClick={() => close(false)}
                        className="flex-1 flex items-start gap-xs p-sm min-w-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${TONE_ICON[tone]}`} aria-hidden="true">
                          <span className="material-symbols-outlined text-[18px]">{icon}</span>
                        </span>
                        <span className="min-w-0">
                          <span className={`block font-body-md text-body-md ${n.isRead ? 'text-on-surface-variant' : 'text-on-surface font-semibold'}`}>
                            {text}
                          </span>
                          <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                            {n.role}
                            {n.changedAt && <> · {timeAgo(n.changedAt)}</>}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => dismissNotification(n.id)}
                        aria-label={`Dismiss: ${text}`}
                        className="shrink-0 self-center mr-1 w-[44px] h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
