import { useCallback, useEffect, useRef, useState } from 'react';

const useCrewToasts = (defaultDuration = 4000) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));

    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback(({ title, message, type = 'info', duration }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toastDuration = duration ?? defaultDuration;

    setToasts(prev => [...prev, { id, title, message, type }]);

    if (toastDuration > 0) {
      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
      }, toastDuration);
    }

    return id;
  }, [defaultDuration, removeToast]);

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
  }, []);

  return { toasts, addToast, removeToast };
};

export default useCrewToasts;
