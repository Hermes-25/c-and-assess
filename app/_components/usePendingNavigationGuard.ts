'use client';

import { useCallback,useEffect, useRef } from 'react';

const defaultMessage = 'Work is still being saved. Leaving now may discard the latest changes. Leave this page anyway?';

export function usePendingNavigationGuard(pending: boolean, message = defaultMessage) {
  const pendingRef = useRef(pending);
  const messageRef = useRef(message);
  useEffect(() => {
    pendingRef.current = pending;
    messageRef.current = message;
  },[pending,message]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLink = (event: MouseEvent) => {
      if (!pendingRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === '_blank' || target.hasAttribute('download')) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.href === window.location.href || (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash)) return;
      if (window.confirm(messageRef.current)) { pendingRef.current = false; return; }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardLink, true);
    };
  }, []);
  return useCallback(() => { pendingRef.current = false; },[]);
}
