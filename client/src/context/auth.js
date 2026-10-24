import { createContext, useContext } from 'react';

// The context object and its hook live apart from the provider component (AuthContext.jsx), so that
// file only exports a component and Fast Refresh can keep its state while editing.
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
