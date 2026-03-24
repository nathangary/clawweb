import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { getStoredCredentials } from '../lib/credentials';

interface HtmlPreviewProps {
  filePath: string;
  fullHeight?: boolean;
}

export function HtmlPreview({ filePath, fullHeight = false }: HtmlPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const fileName = filePath.split('/').pop() || 'chart.html';
      const relativePath = filePath.includes('.nanobot/workspace/') 
        ? filePath.split('.nanobot/workspace/')[1] 
        : fileName;
      const creds = getStoredCredentials();
      const headers: Record<string, string> = {};
      if (creds?.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      }
      const response = await fetch(`/api/v1/files/${encodeURIComponent(relativePath)}`, { headers });
      if (!response.ok) {
        throw new Error('File not found');
      }
      const content = await response.text();
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setSrc(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
    return () => {
      if (src) {
        URL.revokeObjectURL(src);
      }
    };
  }, [filePath]);

  if (error) {
    return (
      <div className="mt-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <p className="text-sm text-red-400">Failed to load: {error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`mt-2 rounded-xl border border-pc-border overflow-hidden ${fullHeight ? 'flex flex-col h-full' : ''} ${isExpanded ? 'fixed inset-0 z-50 flex flex-col' : ''}`}>
      {!fullHeight && (
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--pc-bg-surface)] border-b border-pc-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-pc-text-muted">HTML Preview</span>
            <span className="text-xs text-pc-text-faint truncate max-w-[200px]">{filePath.split('/').pop()}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      )}
      <div className={`bg-white ${fullHeight ? 'flex-1' : isExpanded ? 'flex-1' : 'h-[500px]'}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading...
          </div>
        ) : src ? (
          <iframe
            src={src}
            className="w-full h-full border-0"
            style={isExpanded ? { minHeight: 'calc(100vh - 80px)' } : undefined}
            sandbox="allow-scripts"
            title="HTML Preview"
          />
        ) : null}
      </div>
    </div>
  );
}

export function extractHtmlPath(content: string): string | null {
  const patterns = [
    /\/Users\/[^\s]+\.html/,
    /\/home\/[^\s]+\.html/,
    /[A-Za-z]:\\[^\s]+\.html/,
    /\.nanobot\/[^\s]+\.html/,
    /\/var\/[^\s]+\.html/,
    /\/tmp\/[^\s]+\.html/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}
