import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useT } from '../hooks/useLocale';
import { getStoredCredentials } from '../lib/credentials';

interface Props {
  onConnect: (wsUrl: string, token?: string, restUrl?: string) => void;
  error?: string | null;
  isConnecting?: boolean;
}

const WS_URL_CONFIG = import.meta.env.VITE_GATEWAY_WS_URL || '';
const REST_URL_CONFIG = import.meta.env.VITE_REST_API_URL || '';
const HAS_URL_CONFIG = Boolean(WS_URL_CONFIG || REST_URL_CONFIG);

function getInitialUrl(): string {
  if (WS_URL_CONFIG) return WS_URL_CONFIG;
  const stored = getStoredCredentials();
  if (stored) return stored.url;
  return '/ws';
}

function getInitialRestUrl(): string {
  if (REST_URL_CONFIG) return REST_URL_CONFIG;
  const stored = getStoredCredentials();
  if (stored?.restUrl) return stored.restUrl;
  return '/api';
}

export function LoginScreen({ onConnect, error, isConnecting }: Props) {
  const t = useT();
  const [url, setUrl] = useState(getInitialUrl);
  const [restUrl, setRestUrl] = useState(getInitialRestUrl);
  const [token, setToken] = useState('');

  const urlTrimmed = url.trim();
  const restUrlTrimmed = restUrl.trim();
  const effectiveWsUrl = WS_URL_CONFIG || urlTrimmed;
  const isValidWsUrl = effectiveWsUrl === '/ws' || effectiveWsUrl === '/wss' || /^wss?:\/\/.+/.test(effectiveWsUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const wsUrl = WS_URL_CONFIG || urlTrimmed;
    const apiUrl = REST_URL_CONFIG || restUrlTrimmed;
    if (!wsUrl || !isValidWsUrl) return;
    onConnect(wsUrl, token.trim() || undefined, apiUrl || undefined);
  };

  return (
    <div className="h-dvh flex items-center justify-center bg-[var(--pc-bg-base)] text-pc-text bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.02),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.04),transparent_50%)]">
      <div className="w-full max-w-md mx-4">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="伯俊俊马" className="h-20 w-20 drop-shadow-lg" />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-pc-text tracking-wide">{t('login.title')}</h1>
            <Sparkles className="h-5 w-5 text-pc-accent-light/60" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`rounded-2xl border border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl p-6 ${HAS_URL_CONFIG ? 'space-y-5' : 'space-y-4'} shadow-2xl shadow-black/30`}>
          {!WS_URL_CONFIG && (
            <div className="space-y-2">
              <label htmlFor="gateway-url" className="block text-xs font-medium text-pc-text-secondary uppercase tracking-wider">
                WebSocket URL
              </label>
              <input
                id="gateway-url"
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="ws://192.168.1.14:8787"
                className="w-full rounded-xl border border-pc-border bg-pc-elevated/50 px-4 py-3 text-sm text-pc-text placeholder:text-pc-text-faint outline-none focus:border-[var(--pc-accent-dim)] focus:ring-1 focus:ring-[var(--pc-accent-glow)] transition-all"
                autoComplete="url"
                disabled={isConnecting}
              />
            </div>
          )}

          {!REST_URL_CONFIG && (
            <div className="space-y-2">
              <label htmlFor="rest-url" className="block text-xs font-medium text-pc-text-secondary uppercase tracking-wider">
                REST API URL
              </label>
              <input
                id="rest-url"
                type="text"
                value={restUrl}
                onChange={e => setRestUrl(e.target.value)}
                placeholder="http://192.168.1.14:18790"
                className="w-full rounded-xl border border-pc-border bg-pc-elevated/50 px-4 py-3 text-sm text-pc-text placeholder:text-pc-text-faint outline-none focus:border-[var(--pc-accent-dim)] focus:ring-1 focus:ring-[var(--pc-accent-glow)] transition-all"
                autoComplete="url"
                disabled={isConnecting}
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="gateway-token" className="block text-xs font-medium text-pc-text-secondary uppercase tracking-wider">
              Token (Optional)
            </label>
            <input
              id="gateway-token"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Leave empty if no auth required"
              className="w-full rounded-xl border border-pc-border bg-pc-elevated/50 px-4 py-3 text-sm text-pc-text placeholder:text-pc-text-faint outline-none focus:border-[var(--pc-accent-dim)] focus:ring-1 focus:ring-[var(--pc-accent-glow)] transition-all"
              autoComplete="current-password"
              disabled={isConnecting}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValidWsUrl || isConnecting}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            aria-label={isConnecting ? t('login.connecting') : t('login.connect')}
          >
            {isConnecting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('login.connecting')}
              </>
            ) : (
              t('login.connect')
            )}
          </button>
        </form>

        <p className="text-center text-xs text-pc-text-faint mt-6">
          {t('login.storedLocally')}
        </p>
      </div>
    </div>
  );
}
