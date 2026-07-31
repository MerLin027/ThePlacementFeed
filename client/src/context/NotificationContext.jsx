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

  // DEBUG INSTRUMENTATION — remove after investigation
  const pollTickRef = useRef(0);

  const pollChanges = useCallback(async () => {
    const tickNum = ++pollTickRef.current;
    const tickTime = new Date().toISOString();
    const lastPollTime = localStorage.getItem('lastPollTime');

    console.group(`%c[NotifPoll] Tick #${tickNum} @ ${tickTime}`, 'color: #6366f1; font-weight: bold');
    console.log('  lastPollTime (from localStorage):', lastPollTime);

    try {
      if (!lastPollTime) {
        console.log('  → First-ever visit path (no lastPollTime)');
        // First-ever visit behavior
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
          console.log('  → Set lastPollTime to:', newLastPollTime);
          toast(`Welcome! The latest drive is ${latest.company} - ${latest.role}`, {
            icon: '👋',
            duration: 5000,
          });
        } else {
          const now = new Date().toISOString();
          localStorage.setItem('lastPollTime', now);
          console.log('  → No placements found, set lastPollTime to now:', now);
        }
        console.groupEnd();
        return;
      }

      // Subsequent visits / polling
      const url = `/api/placements/changes?since=${lastPollTime}`;
      console.log('  → Fetching:', url);
      const res = await axios.get(url);
      const responseTime = new Date().toISOString();
      console.log('  → Response received @', responseTime, '| HTTP', res.status);
      console.log('  → Response data:', res.data);
      
      if (res.data?.success && res.data.data.length > 0) {
        const changes = res.data.data;
        const prev = notificationsRef.current;
        console.log('  → Server returned', changes.length, 'change(s):', changes.map(c => `${c.type}@${c.changedAt}`));
        
        // Merge and deduplicate by id
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifs = changes
          .filter(c => !existingIds.has(c.id))
          .map(c => ({ ...c, isRead: false }));

        console.log('  → After dedup:', newNotifs.length, 'genuinely new notif(s)');
          
        if (newNotifs.length > 0) {
          console.log('%c  ✅ SHOWING TOAST(S) NOW', 'color: green; font-weight: bold');
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
        
        // Update lastPollTime to the most recent changedAt from the server to prevent clock-skew race conditions
        const latestChangeTime = changes.reduce((latest, current) => {
          return new Date(current.changedAt) > new Date(latest) ? current.changedAt : latest;
        }, lastPollTime);
        
        console.log('  → Advancing lastPollTime from', lastPollTime, 'to', latestChangeTime);
        localStorage.setItem('lastPollTime', latestChangeTime);
      } else {
        console.log('  → No new changes (server returned empty or data.length === 0). lastPollTime NOT advanced.');
      }
    } catch (error) {
      console.error(`[NotifPoll] Tick #${tickNum} ERROR:`, error);
    }
    console.groupEnd();
  }, []);

  // Setup interval and visibility sync
  useEffect(() => {
    console.log('[NotifPoll] 🟢 Interval SETUP — polling every 60s');
    pollChanges(); // Initial poll on mount
    const intervalId = setInterval(() => {
      console.log(`[NotifPoll] ⏰ setInterval fired @ ${new Date().toISOString()}`);
      pollChanges();
    }, 60000); // 60s
    
    // Instantly sync when user tabs back or wakes device from sleep
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log(`[NotifPoll] 👁 visibilitychange → visible, triggering poll @ ${new Date().toISOString()}`);
        pollChanges();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('[NotifPoll] 🔴 Interval CLEARED (component unmounting)');
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollChanges]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const dismissNotification = (id) => {
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
