import { createContext, useContext } from 'react';

// Context object and hook for NotificationProvider (NotificationContext.jsx); see auth.js for why
// they live in their own file.
export const NotificationContext = createContext(null);

export const useNotifications = () => useContext(NotificationContext);
