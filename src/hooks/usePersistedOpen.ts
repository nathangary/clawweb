import { useState, useCallback } from 'react';

const store = new Map<string, boolean>();

export function usePersistedOpen(key: string, initial = false) {
  const [open, setOpen] = useState(() => store.get(key) ?? initial);

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      store.set(key, next);
      return next;
    });
  }, [key]);

  const set = useCallback((v: boolean) => {
    store.set(key, v);
    setOpen(v);
  }, [key]);

  return [open, toggle, set] as const;
}
