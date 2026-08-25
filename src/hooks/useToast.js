import { useState, useRef, useCallback } from 'react';

export function useToast() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const showToast = useCallback((msg) => {
    setMessage(msg);
    setVisible(true);
    clearTimeout(timerRef.current);
    const duration = msg.length > 60 ? 5200 : 2400;
    timerRef.current = setTimeout(() => setVisible(false), duration);
  }, []);
  return { message, visible, showToast };
}
