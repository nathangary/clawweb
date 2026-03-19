const STORAGE_KEY = 'pinchchat_credentials';

export interface StoredCredentials {
  url: string;
  restUrl?: string;
  token?: string;
  clientId?: string;
}

export function getStoredCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.url) return parsed;
  } catch {
    // Ignore malformed localStorage data
  }
  return null;
}

export function storeCredentials(url: string, token?: string, restUrl?: string, clientId?: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
    url, 
    ...(token ? { token } : {}),
    ...(restUrl ? { restUrl } : {}),
    ...(clientId ? { clientId } : {}),
  }));
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}
