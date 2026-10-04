import { useEffect, useState } from 'react';
import { getAllowanceContext, allowanceError } from '../services/allowanceService';

export function useAllowanceContext(uid) {
  const [state, setState] = useState({ context: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getAllowanceContext().then(context => {
      if (!cancelled) setState({ context, loading: false, error: '' });
    }).catch(error => {
      if (!cancelled) setState({ context: null, loading: false, error: allowanceError(error, { checkingAccess: true }) });
    });
    return () => { cancelled = true; };
  }, [uid, version]);
  return { ...state, refresh: () => {
    setState({ context: null, loading: true, error: '' });
    setVersion(v => v + 1);
  } };
}
