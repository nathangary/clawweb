import { useState, useCallback } from 'react';
import { Download, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import { LazyMarkdown } from './LazyMarkdown';
import { useConnectionStore } from '../stores/connectionStore';

interface DocumentBlockProps {
  name: string;
  url: string;
  ext?: string;
  size?: number;
}

function getFileIcon(ext: string) {
  const e = ext.toLowerCase();
  if (['md', 'txt'].includes(e)) return '📝';
  if (['html', 'htm'].includes(e)) return '🌐';
  if (['pdf'].includes(e)) return '📕';
  if (['csv', 'xlsx', 'xls'].includes(e)) return '📊';
  if (['doc', 'docx'].includes(e)) return '📘';
  if (['json', 'xml', 'yaml', 'yml'].includes(e)) return '📋';
  if (['js', 'ts', 'py', 'go', 'rs', 'java', 'c', 'cpp'].includes(e)) return '💻';
  return '📄';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAccessibleFileUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return url;
  const apiClient = useConnectionStore.getState().getApiClient();
  if (!apiClient) return url;
  const baseUrl = apiClient.getBaseUrl().replace('/api', '');
  if (url.startsWith('/api/')) return `${baseUrl}${url}`;
  const match = url.match(/workspace[/\\](.+)$/);
  const relativePath = match ? match[1] : url;
  return `${baseUrl}/api/v1/files/${encodeURIComponent(relativePath)}`;
}

function isPreviewable(ext: string): boolean {
  return ['md', 'txt', 'html', 'htm', 'json', 'xml', 'yaml', 'yml', 'csv', 'log'].includes(ext.toLowerCase());
}

export function DocumentBlock({ name, url, ext, size }: DocumentBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessibleUrl = getAccessibleFileUrl(url);
  const isMd = ext?.toLowerCase() === 'md';
  const canPreview = isPreviewable(ext || '');

  const handlePreview = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (content) {
      setExpanded(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(accessibleUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setContent(text);
      setExpanded(true);
    } catch {
      setError('无法加载文件预览');
    } finally {
      setLoading(false);
    }
  }, [expanded, content, accessibleUrl]);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = accessibleUrl;
    a.download = name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }, [accessibleUrl, name]);

  const displayName = name || url.split('/').pop() || 'document';

  return (
    <div className="my-2 rounded-xl border border-pc-border bg-pc-elevated/30 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="text-2xl shrink-0">{getFileIcon(ext || '')}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-pc-text font-medium truncate">{displayName}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-pc-text-muted">
            {ext && <span className="uppercase px-1 py-0.5 rounded bg-pc-border/50">{ext}</span>}
            {size && <span>{formatFileSize(size)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-accent-light hover:bg-[var(--pc-hover)] transition-colors"
            title="下载文件"
            aria-label="下载文件"
          >
            <Download size={14} />
          </button>
          {canPreview && (
            <button
              onClick={handlePreview}
              disabled={loading}
              className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-accent-light hover:bg-[var(--pc-hover)] transition-colors disabled:opacity-50"
              title={expanded ? '收起预览' : '预览文件'}
              aria-label={expanded ? '收起预览' : '预览文件'}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : expanded ? (
                <ChevronUp size={14} />
              ) : (
                <ExternalLink size={14} />
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-pc-border">
          {error ? (
            <div className="px-3 py-2 text-xs text-red-400">{error}</div>
          ) : loading ? (
            <div className="px-3 py-4 flex items-center justify-center text-pc-text-muted">
              <Loader2 size={14} className="animate-spin mr-2" />
              <span className="text-xs">加载中...</span>
            </div>
          ) : content ? (
            <div className={`max-h-96 overflow-y-auto ${isMd ? 'p-3' : ''}`}>
              {isMd ? (
                <div className="prose prose-sm max-w-none">
                  <LazyMarkdown>{content}</LazyMarkdown>
                </div>
              ) : (
                <pre className="text-xs text-pc-text-muted whitespace-pre-wrap font-mono p-3 bg-pc-base/50">{content}</pre>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
