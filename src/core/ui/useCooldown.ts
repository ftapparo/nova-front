import { useCallback, useEffect, useState } from "react";

/**
 * Contagem regressiva para o `Retry-After` de um 429: enquanto
 * `remainingSeconds` for maior que zero, a ação fica desabilitada.
 */
export function useCooldown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (endsAt === null) return;
    const timer = window.setInterval(() => {
      const remaining = Math.ceil((endsAt - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, remaining));
      if (remaining <= 0) setEndsAt(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    setRemainingSeconds(seconds);
    setEndsAt(Date.now() + seconds * 1000);
  }, []);

  return { remainingSeconds, start };
}
