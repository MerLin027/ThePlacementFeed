import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Link } from 'react-router-dom';

const NotificationBell = () => {
  const { notifications, unreadCount, markAllAsRead, clearAll, dismissNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      markAllAsRead();
    }
    setIsOpen(!isOpen);
  };

  const getLabel = (notif) => {
    switch (notif.type) {
      case 'new':
        return `New drive: ${notif.company}`;
      case 'statusChange':
        return `${notif.company} status changed`;
      case 'postponed':
        return `${notif.company} postponed`;
      case 'unpostponed':
        return `${notif.company} is no longer postponed`;
      case 'edit':
        return `${notif.company} details updated`;
      default:
        return `${notif.company} updated`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[24px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between p-4 border-b border-outline-variant">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-primary hover:text-primary-focus text-label-md font-label-md transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 content-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">done_all</span>
                <p className="font-body-md">You're all caught up!</p>
                <p className="text-body-sm opacity-75">No new notifications</p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {notifications.map((notif) => (
                  <li key={notif.id} className="relative hover:bg-surface-container-low transition-colors group">
                    <Link
                      to={`/placement/${notif.placementId}`}
                      onClick={() => setIsOpen(false)}
                      className="block p-4 pr-10"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${notif.isRead ? 'bg-transparent' : 'bg-primary'}`}></div>
                        <div>
                          <p className={`font-body-md ${notif.isRead ? 'text-on-surface-variant' : 'text-on-surface font-semibold'}`}>
                            {getLabel(notif)}
                          </p>
                          <p className="text-body-sm text-on-surface-variant mt-1">
                            {notif.role}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notif.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-error/10 focus-visible:opacity-100"
                      aria-label="Dismiss notification"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
