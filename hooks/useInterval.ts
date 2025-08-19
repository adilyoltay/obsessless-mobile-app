import { useEffect, useRef } from 'react';

/**
 * Güvenli interval yönetimi için custom hook
 * Component unmount olduğunda otomatik temizleme yapar
 */
export function useInterval(
  callback: () => void,
  delay: number | null
): void {
  const savedCallback = useRef<(() => void) | null>(null);

  // Callback'i güncelle
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Interval'ı kur
  useEffect(() => {
    function tick() {
      if (savedCallback.current) savedCallback.current();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default useInterval; 