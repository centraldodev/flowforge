import { useEffect, useState } from 'react';

const NOTICE_DURATION = 5000;

/** Mensagem temporária (toast) que some sozinha. */
export function useNotice() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), NOTICE_DURATION);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}
