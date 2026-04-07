import { useState, useEffect, useCallback, useMemo } from 'react';
import { Maximize2, Minimize2, RefreshCw, Download, FileText, X } from 'lucide-react';
import { getStoredCredentials } from '../lib/credentials';
import { LazyMarkdown } from './LazyMarkdown';

interface DocumentPreviewProps {
  assetId: string;
  fileName: string;
  mimeType?: string;
  fullHeight?: boolean;
}

type FileType = 'markdown' | 'html' | 'image' | 'video' | 'other';

function getFileType(fileName: string, mimeType?: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'txt' || mimeType === 'text/markdown' || mimeType === 'text/plain') return 'markdown';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  return 'other';
}

function getFileIcon(fileType: FileType) {
  switch (fileType) {
    case 'markdown': return <FileText size={14} />;
    case 'html': return <FileText size={14} />;
    default: return <FileText size={14} />;
  }
}

function getFileLabel(fileType: FileType) {
  switch (fileType) {
    case 'markdown': return 'Markdown';
    case 'html': return 'HTML';
    case 'image': return 'Image';
    case 'video': return 'Video';
    default: return 'Document';
  }
}

interface Header {
  level: number;
  text: string;
  id: string;
}

function parseHeaders(content: string): Header[] {
  const headers: Header[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      headers.push({ level, text, id });
    }
  }
  return headers;
}

function getDownloadUrl(assetId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/v1/admin/assets/${encodeURIComponent(assetId)}/download`;
}

export function DocumentPreview({ assetId, fileName, mimeType, fullHeight = false }: DocumentPreviewProps) {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [htmlSrc, setHtmlSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const fileType = useMemo(() => getFileType(fileName, mimeType), [fileName, mimeType]);
  const headers = useMemo(() => {
    if (!fileContent || fileType !== 'markdown') return [];
    return parseHeaders(fileContent);
  }, [fileContent, fileType]);

  const loadFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const creds = getStoredCredentials();
      const headers: Record<string, string> = {};
      if (creds?.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      }

      const response = await fetch(`/api/v1/admin/assets/${assetId}/download`, { headers });
      if (!response.ok) {
        throw new Error('File not found');
      }

      const blob = await response.blob();

      if (fileType === 'html') {
        const text = await blob.text();
        const injectStyles = `
<style>
  html, body { margin: 0; padding: 0; height: 100vh; overflow: auto; }
  [id*="chart"], [class*="chart"], [id*="echarts"], [class*="echarts"],
  [id*="canvas"], [class*="canvas"], svg, canvas {
    width: 100% !important;
    height: 100vh !important;
    min-height: 100vh !important;
  }
  .echarts, #echarts, .chart-container, .chart-wrapper,
  [data-chart], .recharts-wrapper, .recharts-surface {
    width: 100% !important;
    height: 100vh !important;
  }
</style>`;
        const injectScript = `
<script>
  (function() {
    function resizeCharts() {
      if (window.echarts) {
        document.querySelectorAll('[id*="echarts"], [class*="echarts"]').forEach(function(el) {
          var instance = echarts.getInstanceByDom(el);
          if (instance) instance.resize();
        });
      }
      if (window.Chart) {
        Object.values(Chart.instances || {}).forEach(function(chart) {
          chart.resize();
        });
      }
      window.dispatchEvent(new Event('resize'));
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(resizeCharts, 300); });
    } else {
      setTimeout(resizeCharts, 300);
    }
    window.addEventListener('resize', resizeCharts);
  })();
</script>`;
        let modifiedHtml = text;
        if (modifiedHtml.includes('</head>')) {
          modifiedHtml = modifiedHtml.replace('</head>', injectStyles + '</head>');
        } else {
          modifiedHtml = injectStyles + modifiedHtml;
        }
        if (modifiedHtml.includes('</body>')) {
          modifiedHtml = modifiedHtml.replace('</body>', injectScript + '</body>');
        } else {
          modifiedHtml = modifiedHtml + injectScript;
        }
        const htmlBlob = new Blob([modifiedHtml], { type: 'text/html' });
        setHtmlSrc(URL.createObjectURL(htmlBlob));
        setFileContent(text);
      } else if (fileType === 'markdown' || fileType === 'other') {
        const text = await blob.text();
        setFileContent(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [assetId, fileType]);

  useEffect(() => {
    loadFile();
    return () => {
      if (htmlSrc) {
        URL.revokeObjectURL(htmlSrc);
      }
    };
  }, [assetId]);

  const handleDownload = useCallback(() => {
    const url = getDownloadUrl(assetId);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  }, [assetId, fileName]);

  if (error) {
    return (
      <div className="mt-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <p className="text-sm text-red-400">Failed to load: {error}</p>
        <button
          onClick={loadFile}
          className="mt-2 flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const headerBar = (
    <div className="flex items-center justify-between px-3 py-2 bg-[var(--pc-bg-surface)] border-b border-pc-border">
      <div className="flex items-center gap-2">
        {getFileIcon(fileType)}
        <span className="text-xs text-pc-text-muted">{getFileLabel(fileType)}</span>
        <span className="text-xs text-pc-text-faint truncate max-w-[200px]">{fileName}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]"
          title="Download"
        >
          <Download size={14} />
        </button>
        <button
          onClick={loadFile}
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
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading...
        </div>
      );
    }

    if (fileType === 'html') {
      return (
        <iframe
          src={htmlSrc || undefined}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts"
          title={fileName}
        />
      );
    }

    if (fileType === 'markdown') {
      return (
        <div className="flex h-full min-h-0">
          {showSidebar && headers.length > 0 && (
            <div className="w-48 shrink-0 overflow-y-auto border-r border-pc-border p-4 space-y-2 bg-[var(--pc-bg-surface)]">
              <h3 className="text-xs font-semibold text-pc-text-muted mb-3 uppercase tracking-wider">目录</h3>
              {headers.map((h, i) => (
                <a
                  key={i}
                  href={`#${h.id}`}
                  className="block text-xs text-pc-text-secondary hover:text-pc-accent truncate"
                  style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                >
                  {h.text}
                </a>
              ))}
            </div>
          )}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
            <div className="p-4">
              <article className="prose prose-sm dark:prose-invert max-w-none">
                <LazyMarkdown components={{
                  h1: ({ node, ...props }) => <h1 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                  h2: ({ node, ...props }) => <h2 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                  h3: ({ node, ...props }) => <h3 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                  h4: ({ node, ...props }) => <h4 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                  h5: ({ node, ...props }) => <h5 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                  h6: ({ node, ...props }) => <h6 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                }}>{fileContent || ''}</LazyMarkdown>
              </article>
            </div>
          </div>
        </div>
      );
    }

    if (fileType === 'image') {
      return (
        <div className="flex items-center justify-center h-full p-4 bg-[var(--pc-bg-base)]">
          <img
            src={getDownloadUrl(assetId)}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        </div>
      );
    }

    if (fileType === 'video') {
      return (
        <div className="flex items-center justify-center h-full p-4 bg-[var(--pc-bg-base)]">
          <video
            controls
            className="max-w-full max-h-full rounded-xl"
            src={getDownloadUrl(assetId)}
          />
        </div>
      );
    }

    return (
      <pre className="text-xs text-pc-text-muted whitespace-pre-wrap font-mono bg-[var(--pc-bg-base)] p-4 overflow-auto h-full">
        {fileContent || '无法预览此文件类型'}
      </pre>
    );
  };

  return (
    <div className={`mt-2 rounded-xl border border-pc-border overflow-hidden ${fullHeight ? 'flex flex-col h-full' : ''} ${isExpanded ? 'fixed inset-0 z-50 flex flex-col' : ''}`}>
      {!fullHeight && headerBar}
      {fileType === 'markdown' && headers.length > 0 && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="px-3 py-1 text-[10px] text-pc-text-muted hover:text-pc-text bg-[var(--pc-bg-surface)] border-b border-pc-border flex items-center gap-1"
        >
          {showSidebar ? <><X size={10} /> 隐藏目录</> : '显示目录'}
        </button>
      )}
      <div className={`${fullHeight ? 'flex-1 min-h-0' : isExpanded ? 'flex-1 min-h-0' : 'h-[500px]'} ${fileType === 'html' ? 'bg-white' : 'bg-[var(--pc-bg-elevated)]'} overflow-hidden`}>
        {renderContent()}
      </div>
    </div>
  );
}

export interface DocumentInfo {
  assetId: string;
  url?: string;
  fileName: string;
  mimeType?: string;
}

export function extractDocuments(multimodalResponse: { media?: Array<{ type?: string; source?: string; url?: string; asset_id?: string; mime_type?: string }> }): DocumentInfo[] {
  if (!multimodalResponse?.media) return [];
  
  return multimodalResponse.media
    .filter(m => m.type === 'document' && m.asset_id)
    .map(m => ({
      assetId: m.asset_id!,
      url: m.url,
      fileName: m.url ? m.url.split('/').pop() || 'document' : 'document',
      mimeType: m.mime_type,
    }));
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

export interface HtmlDocumentInfo {
  assetId: string;
  url?: string;
  fileName: string;
  mimeType?: string;
}

export function extractHtmlDocuments(multimodalResponse: { media?: Array<{ type?: string; source?: string; url?: string; asset_id?: string; mime_type?: string }> }): HtmlDocumentInfo[] {
  if (!multimodalResponse?.media) return [];
  
  return multimodalResponse.media
    .filter(m => m.type === 'document' && m.mime_type === 'text/html' && m.asset_id)
    .map(m => ({
      assetId: m.asset_id!,
      url: m.url,
      fileName: m.url ? m.url.split('/').pop() || 'document.html' : 'document.html',
      mimeType: m.mime_type,
    }));
}
