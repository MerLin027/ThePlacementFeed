import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const notificationsRef = useRef([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load state from localStorage on mount and listen to cross-tab updates
  useEffect(() => {
    const loadFromStorage = () => {
      const stored = localStorage.getItem('placement_notifications');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setNotifications(parsed);
          notificationsRef.current = parsed;
          setUnreadCount(parsed.filter((n) => !n.isRead).length);
        } catch (e) {
          console.error('Failed to parse notifications from localStorage', e);
        }
      }
    };
    
    // Initial load
    loadFromStorage();
    
    // Listen for storage changes from other tabs
    const handleStorageChange = (e) => {
      if (e.key === 'placement_notifications') {
        loadFromStorage();
      }
      // Another tab cleared/dismissed — remove those IDs from our in-memory list
      if (e.key === 'dismissedNotifIds') {
        try {
          const dismissed = new Set(JSON.parse(e.newValue || '[]'));
          setNotifications(prev => {
            const filtered = prev.filter(n => !dismissed.has(n.id));
            return filtered.length !== prev.length ? filtered : prev;
          });
        } catch { /* ignore malformed JSON from another tab */ }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync unreadCount whenever notifications change, and save to localStorage
  useEffect(() => {
    notificationsRef.current = notifications;
    setUnreadCount(notifications.filter((n) => !n.isRead).length);
    
    if (notifications.length > 0 || localStorage.getItem('placement_notifications')) {
      const stringified = JSON.stringify(notifications);
      // Prevent disk I/O thrashing if the state is identically synced from another tab
      if (localStorage.getItem('placement_notifications') !== stringified) {
        localStorage.setItem('placement_notifications', stringified);
      }
    }
  }, [notifications]);

  const pollChanges = useCallback(async () => {
    const lastPollTime = localStorage.getItem('lastPollTime');

    try {
      if (!lastPollTime) {
        // First-ever visit: seed lastPollTime from the most recent drive
        const res = await axios.get('/api/placements?sort=newest&limit=1');
        if (res.data?.success && res.data.data.length > 0) {
          const latest = res.data.data[0];
          const newNotif = {
            id: `welcome-${latest._id}`,
            placementId: latest._id,
            company: latest.company,
            role: latest.role,
            type: 'new',
            changedAt: new Date().toISOString(),
            isRead: false,
          };
          setNotifications([newNotif]);
          const newLastPollTime = latest.updatedAt || latest.createdAt;
          localStorage.setItem('lastPollTime', newLastPollTime);
          toast(`Welcome! The latest drive is ${latest.company} - ${latest.role}`, {
            icon: '👋',
            duration: 5000,
          });
        } else {
          localStorage.setItem('lastPollTime', new Date().toISOString());
        }
        return;
      }

      // Subsequent visits / polling
      const res = await axios.get(`/api/placements/changes?since=${lastPollTime}`);

      const changeCount = res.data?.data?.length ?? 0;

      if (res.data?.success && changeCount > 0) {
        const changes = res.data.data;
        const prev = notificationsRef.current;

        // Filter out any IDs the user has already explicitly dismissed
        const dismissedIds = JSON.parse(localStorage.getItem('dismissedNotifIds') || '[]');
        const dismissedSet = new Set(dismissedIds);

        // Merge and deduplicate by id
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifs = changes
          .filter(c => !existingIds.has(c.id) && !dismissedSet.has(c.id))
          .map(c => ({ ...c, isRead: false }));
          
        if (newNotifs.length > 0) {
          newNotifs.forEach(notif => {
            if (notif.type === 'postponed') {
              toast.error(`${notif.company} drive has been postponed!`, {
                duration: 6000,
                style: {
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 'bold'
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#ef4444',
                },
              });
            } else if (notif.type === 'unpostponed') {
              toast.success(`${notif.company} drive is no longer postponed.`, {
                duration: 6000,
              });
            } else if (notif.type === 'statusChange') {
              toast(`${notif.company} status changed`, { duration: 5000, icon: 'ℹ️' });
            } else if (notif.type === 'new') {
              toast.success(`New drive: ${notif.company}`, { duration: 5000 });
            } else if (notif.type === 'edit') {
              toast(`${notif.company} details updated`, { duration: 5000, icon: '📝' });
            } else if (notif.type === 'automationReset') {
              toast(`${notif.company} status automation reset`, { duration: 5000, icon: '🔄' });
            } else {
              toast(`${notif.company} updated`, { duration: 5000, icon: '🔔' });
            }
          });

          const combined = [...newNotifs, ...prev];
          // Cap at 15 items
          setNotifications(combined.slice(0, 15));
        }
        
        // Update lastPollTime to the most recent changedAt from the server
        // to prevent clock-skew race conditions
        const latestChangeTime = changes.reduce((latest, current) => {
          return new Date(current.changedAt) > new Date(latest) ? current.changedAt : latest;
        }, lastPollTime);
        
        localStorage.setItem('lastPollTime', latestChangeTime);
      }
    } catch (error) {
      console.error('[NotifPoll] Failed to fetch changes:', error);
    }
  }, []);

  // Setup polling interval and visibility-based sync
  useEffect(() => {
    pollChanges(); // Initial poll on mount
    const intervalId = setInterval(pollChanges, 20000); // 20s — reduced from 60s for time-sensitive updates
    
    // Instantly sync when user tabs back or wakes device from sleep
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollChanges();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollChanges]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const clearAll = () => {
    const current = notificationsRef.current;

    // Advance lastPollTime past every cleared notification so they are never
    // re-fetched from the server after a refresh (Bug 1 fix).
    if (current.length > 0) {
      const latestClearedAt = current.reduce((latest, n) => {
        return new Date(n.changedAt) > new Date(latest) ? n.changedAt : latest;
      }, current[0].changedAt);
      // Merge (not replace) cleared IDs with any previously dismissed IDs.
      // Replacing would drop individually-dismissed IDs, allowing them to
      // reappear via the server's 10-second overlap buffer on the next poll.
      const existing = JSON.parse(localStorage.getItem('dismissedNotifIds') || '[]');
      const merged = [...new Set([...existing, ...current.map(n => n.id)])];
      // Cap at 100 entries to prevent unbounded localStorage growth
      const capped = merged.slice(-100);
      localStorage.setItem('dismissedNotifIds', JSON.stringify(capped));
      localStorage.setItem('lastPollTime', latestClearedAt);
    }

    setNotifications([]);
  };

  const dismissNotification = (id) => {
    const target = notificationsRef.current.find(n => n.id === id);

    // Persist the dismissed ID so this specific notification is never
    // re-fetched even if lastPollTime hasn't advanced past it (Bug 1 fix).
    if (target) {
      const existing = JSON.parse(localStorage.getItem('dismissedNotifIds') || '[]');
      if (!existing.includes(id)) {
        existing.push(id);
        // Cap at 100 entries to prevent unbounded localStorage growth
        const capped = existing.slice(-100);
        localStorage.setItem('dismissedNotifIds', JSON.stringify(capped));
      }
    }

    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllAsRead,
        clearAll,
        dismissNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
