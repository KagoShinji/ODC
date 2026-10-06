import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDemoContext, demoError } from '../services/demoService';

export function useDemoContext(uid) {
  const [state, setState] = useState({ uid, context: null, loading: true, error: '' });
  const [notifications, setNotifications] = useState({ uid, rows: [], unread: 0, rowsError: '', unreadError: '' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let disposed = false;
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try { const context = await getDemoContext(); if (!disposed) setState({ uid, context, loading: false, error: '' }); }
      catch (error) { if (!disposed) setState({ uid, context: null, loading: false, error: demoError(error) }); }
      finally { running = false; }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { disposed = true; clearInterval(timer); };
  }, [uid, version]);
  const active = state.uid === uid && state.context?.access?.active === true;
  useEffect(() => {
    if (!active) return;
    const update = values => setNotifications(s => ({ ...(s.uid === uid ? s : { rows: [], unread: 0, rowsError: '', unreadError: '' }), uid, ...values }));
    const rowsQuery = query(collection(db, 'demoNotifications'), where('recipientUid', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    const unreadQuery = query(collection(db, 'demoNotifications'), where('recipientUid', '==', uid), where('read', '==', false));
    const stopRows = onSnapshot(rowsQuery, snapshot => update({ rows: snapshot.docs.map(d => ({ ...d.data(), id: d.id })), rowsError: '' }), error => update({ rowsError: demoError(error) }));
    const stopCount = onSnapshot(unreadQuery, snapshot => update({ unread: snapshot.size, unreadError: '' }), error => update({ unreadError: demoError(error) }));
    return () => { stopRows(); stopCount(); };
  }, [uid, active, version]);
  return { ...(state.uid === uid ? state : { context: null, loading: true, error: '' }), notifications: active && notifications.uid === uid ? notifications.rows : [], unread: active && notifications.uid === uid ? notifications.unread : 0, notificationError: active && notifications.uid === uid ? notifications.rowsError || notifications.unreadError : '', refresh };
}
