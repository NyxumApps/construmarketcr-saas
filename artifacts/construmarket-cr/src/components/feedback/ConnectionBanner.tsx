import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Aviso discreto mientras el navegador no tiene conexión. */
export function ConnectionBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-foreground px-4 py-3 text-sm text-background"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Sin conexión. Lo que ve puede no estar al día; se actualizará al volver la señal.</span>
    </div>
  );
}
