import { createContext, useContext } from 'react';

// Context object and hook for MyApplicationsProvider (MyApplicationsContext.jsx); see auth.js for why
// they live in their own file.
export const MyApplicationsContext = createContext(null);

export const useMyApplications = () => {
  const context = useContext(MyApplicationsContext);
  if (!context) {
    throw new Error('useMyApplications must be used within a MyApplicationsProvider');
  }
  return context;
};
