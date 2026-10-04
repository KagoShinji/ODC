import { useEffect, useCallback, useRef, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { allowanceError } from '../services/allowanceService';

const COLLECTIONS = ['allowanceAccounts', 'allowanceMeetings', 'allowanceLiquidations', 'allowanceRequisitions', 'allowanceLedger', 'allowanceAuditEvents'];
const PAGE_SIZE = 30;
export function useAllowances(uid, access) {
  const [state, setState] = useState({ rows: {}, more: {}, loading: false, error: '' });
  const cursors = useRef({});
  const generation = useRef(0);
  const broad = access?.actions?.some(x => ['allowances:manage', 'allowances:review', 'allowances:approve', 'allowances:release', 'allowances:reports', 'allowances:reverse'].includes(x));
  const ready = Boolean(access?.active);
  const fetchPage = useCallback(async (name, after) => {
    const constraints = [...(broad ? [] : [where('ownerUid', '==', uid)]), orderBy('createdAt', 'desc'), ...(after ? [startAfter(after)] : []), limit(PAGE_SIZE)];
    return getDocs(query(collection(db, name), ...constraints));
  }, [broad, uid]);
  const refresh = useCallback(async () => {
    if (!ready) return;
    const token = ++generation.current;
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const pages = await Promise.all(COLLECTIONS.map(name => fetchPage(name)));
      if (token !== generation.current) return;
      const rows = {}; const more = {};
      pages.forEach((page, i) => {
        const name = COLLECTIONS[i]; rows[name] = page.docs.map(d => ({ ...d.data(), id: d.id }));
        cursors.current[name] = page.docs.at(-1); more[name] = page.size === PAGE_SIZE;
      });
      setState({ rows, more, loading: false, error: '' });
    } catch (error) { if (token === generation.current) setState(s => ({ ...s, loading: false, error: allowanceError(error) })); }
  }, [fetchPage, ready]);
  useEffect(() => {
    // Async refresh is cancelled on identity/access changes and on unmount.
    Promise.resolve().then(refresh);
    const counter = generation;
    return () => { counter.current++; };
  }, [refresh]);
  const loadMore = async name => {
    const token = generation.current;
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const page = await fetchPage(name, cursors.current[name]);
      if (token !== generation.current) return;
      cursors.current[name] = page.docs.at(-1);
      setState(s => ({ ...s, loading: false, rows: { ...s.rows, [name]: [...(s.rows[name] || []), ...page.docs.map(d => ({ ...d.data(), id: d.id }))] }, more: { ...s.more, [name]: page.size === PAGE_SIZE } }));
    } catch (error) { if (token === generation.current) setState(s => ({ ...s, loading: false, error: allowanceError(error) })); }
  };
  return { ...state, refresh, loadMore };
}
