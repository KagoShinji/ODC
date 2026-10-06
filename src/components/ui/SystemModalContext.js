import { createContext, useContext } from 'react';

export const SystemModalContext = createContext(null);

export function useSystemModal() {
  const context = useContext(SystemModalContext);
  if (!context) throw new Error('useSystemModal must be used within SystemModalProvider.');
  return context;
}
