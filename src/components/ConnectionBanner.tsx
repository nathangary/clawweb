import { useState, useEffect, useRef, useMemo } from 'react';
import { Wifi, Loader2, ShieldAlert } from 'lucide-react';
import type { ConnectionStatus } from '../types';
import { useT } from '../hooks/useLocale';

interface Props {
  status: ConnectionStatus;
}

type BannerState = 'hidden' | 'reconnecting' | 'reconnected' | 'pairing';

const BANNER_DEBOUNCE_MS = 1500;
const RECONNECTED_DISMISS_MS = 3000;

export function ConnectionBanner({ status }: Props) {
  const t = useT();
  const prevStatus = useRef<ConnectionStatus | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isPairing, setIsPairing] = useState(false);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;

    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    const scheduleReconnectBanner = () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => setShowReconnecting(true), BANNER_DEBOUNCE_MS);
    };

    if (status === 'pairing') {
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      setIsPairing(true);
      setShowReconnecting(false);
      setShowReconnected(false);
    } else if (status === 'disconnected') {
      setIsPairing(false);
      if (prev === null || prev === 'connected' || prev === 'pairing') {
        scheduleReconnectBanner();
      }
    } else if (status === 'connecting') {
      setIsPairing(false);
      if (prev === 'connected' || prev === 'pairing') {
        scheduleReconnectBanner();
      }
    } else if (status === 'connected' && prev !== null && prev !== 'connected') {
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      setIsPairing(false);
      setShowReconnecting(false);
      setShowReconnected(true);
      dismissTimer.current = setTimeout(() => setShowReconnected(false), RECONNECTED_DISMISS_MS);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [status]);

  const banner = useMemo<BannerState>(() => {
    if (isPairing) return 'pairing';
    if (showReconnecting) return 'reconnecting';
    if (showReconnected) return 'reconnected';
    return 'hidden';
  }, [isPairing, showReconnecting, showReconnected]);

  if (banner === 'hidden') return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all duration-500 animate-in slide-in-from-top ${
        isPairing
          ? 'bg-blue-500/10 text-blue-300 border-b border-blue-500/20'
          : showReconnecting
            ? 'bg-amber-500/10 text-amber-300 border-b border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/20'
      }`}
    >
      {isPairing ? (
        <>
          <ShieldAlert size={14} />
          <span>{t('connection.pairing')}</span>
        </>
      ) : showReconnecting ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>{t('connection.reconnecting')}</span>
        </>
      ) : (
        <>
          <Wifi size={14} />
          <span>{t('connection.reconnected')}</span>
        </>
      )}
    </div>
  );
}
