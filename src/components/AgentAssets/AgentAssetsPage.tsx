import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Search, FileText, Download, Trash2, Clock, FolderOpen, ChevronRight, Image, Video, FileArchive, Globe, Bot } from 'lucide-react';
import { LazyMarkdown } from '../LazyMarkdown';
import type { AssetItem, AssetCategory } from '../../lib/nanobotApi';
import type { NanobotApiClient } from '../../lib/nanobotApi';

interface Props {
  onClose: () => void;
  apiClient: NanobotApiClient;
}

function categoryIcon(category: string, size = 14) {
  switch (category) {
    case 'images': return <Image size={size} />;
    case 'video': return <Video size={size} />;
    case 'media': return <FileArchive size={size} />;
    case 'htmls': return <Globe size={size} />;
    default: return <FileText size={size} />;
  }
}

function categoryColor(category: string) {
  switch (category) {
    case 'images': return 'text-blue-400 bg-blue-500/15';
    case 'video': return 'text-purple-400 bg-purple-500/15';
    case 'media': return 'text-orange-400 bg-orange-500/15';
    case 'htmls': return 'text-emerald-400 bg-emerald-500/15';
    default: return 'text-zinc-400 bg-zinc-500/15';
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'images': return '图片';
    case 'video': return '视频';
    case 'media': return '媒体';
    case 'htmls': return '网页';
    default: return category;
  }
}

function getFileType(asset: AssetItem): 'markdown' | 'html' | 'image' | 'video' | 'pdf' | 'other' {
  const ext = asset.ext.toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'txt') return 'markdown';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'other';
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

export function AgentAssetsPage({ onClose, apiClient }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<AssetItem | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState<string | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!fileContent || getFileType(selectedFile!) !== 'markdown') return [];
    return parseHeaders(fileContent);
  }, [fileContent, selectedFile]);

  const loadAssets = useCallback(async (category?: string, query?: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 200, sort: 'desc' };
      if (category && category !== 'all') params.category = category;
      if (query) params.q = query;
      const res = await apiClient.getAgentAssets(params);
      if (res.applied) setAssets(res.data.items);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const catsRes = await apiClient.getAgentAssetCategories();
        if (catsRes.applied) setCategories(catsRes.data.categories);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadData();
    loadAssets();
  }, [apiClient, loadAssets]);

  useEffect(() => {
    loadAssets(categoryFilter, searchQuery || undefined);
  }, [categoryFilter, searchQuery, loadAssets]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const handleSelectFile = useCallback(async (asset: AssetItem) => {
    setSelectedFile(asset);
    setFileContent(null);
    if (htmlSrc) { URL.revokeObjectURL(htmlSrc); setHtmlSrc(null); }
    if (pdfSrc) { URL.revokeObjectURL(pdfSrc); setPdfSrc(null); }
    if (imgSrc) { URL.revokeObjectURL(imgSrc); setImgSrc(null); }
    const fileType = getFileType(asset);
    if (fileType === 'markdown' || fileType === 'html' || fileType === 'other') {
      try {
        const blob = await apiClient.downloadAsset(asset.id);
        const text = await blob.text();
        setFileContent(text);
        if (fileType === 'html') {
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
          if (modifiedHtml.includes('</body>')) {
            modifiedHtml = modifiedHtml.replace('</body>', injectScript + '</body>');
          } else {
            modifiedHtml = modifiedHtml + injectScript;
          }
          const htmlBlob = new Blob([modifiedHtml], { type: 'text/html' });
          setHtmlSrc(URL.createObjectURL(htmlBlob));
        }
      } catch (error) {
        console.error('Failed to load file content:', error);
        setFileContent('加载文件内容失败');
      }
    } else if (fileType === 'pdf') {
      try {
        const blob = await apiClient.downloadAsset(asset.id);
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        setPdfSrc(URL.createObjectURL(pdfBlob));
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setFileContent('加载 PDF 失败');
      }
    } else if (fileType === 'image') {
      try {
        const blob = await apiClient.downloadAsset(asset.id);
        const imgBlob = new Blob([blob], { type: blob.type || 'image/*' });
        setImgSrc(URL.createObjectURL(imgBlob));
      } catch (error) {
        console.error('Failed to load image:', error);
      }
    }
  }, [apiClient, htmlSrc, pdfSrc, imgSrc]);

  const handleDownload = async () => {
    if (!selectedFile || downloading) return;
    setDownloading(true);
    try {
      const blob = await apiClient.downloadAsset(selectedFile.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    if (!confirm(`确定删除 "${selectedFile.name}" 吗？`)) return;
    try {
      const res = await apiClient.deleteAsset(selectedFile.id);
      if (res.applied) {
        setAssets(prev => prev.filter(a => a.id !== selectedFile.id));
        setSelectedFile(null);
        setFileContent(null);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDeleteAsset = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const asset = assets.find(a => a.id === assetId);
    if (!asset || !confirm(`确定删除 "${asset.name}" 吗？`)) return;
    try {
      const res = await apiClient.deleteAsset(assetId);
      if (res.applied) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
        if (selectedFile?.id === assetId) {
          setSelectedFile(null);
          setFileContent(null);
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex">
      <div className="w-80 md:w-96 flex-shrink-0 border-r border-pc-border flex flex-col bg-[var(--pc-bg-base)]">
        <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-400/15 to-violet-500/15 blur-md" />
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-[var(--pc-accent-glow)]">
                  <Bot size={16} className="text-pc-accent" />
                </div>
              </div>
              <div>
                <h1 className="font-semibold text-pc-text text-sm">智能体资产</h1>
                <p className="text-[10px] text-pc-text-muted">查看智能体生成的资产</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-3 pb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文件名..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-pc-border bg-[var(--pc-bg-surface)] text-xs text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-1 focus:ring-[var(--pc-accent-dim)] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pc-text-muted hover:text-pc-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex-1 bg-[var(--pc-bg-surface)] text-xs text-pc-text-secondary rounded-lg px-2 py-1.5 border border-pc-border outline-none cursor-pointer"
              >
                <option value="all">全部类型</option>
                {categories.map(cat => (
                  <option key={cat.name} value={cat.name}>{categoryLabel(cat.name)}</option>
                ))}
              </select>
              <span className="text-xs text-pc-text-muted">{assets.length} 个文件</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--pc-hover)] flex items-center justify-center mb-3">
                <div className="w-6 h-6 border-2 border-pc-accent/30 border-t-pc-accent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-pc-text-secondary font-medium">加载中...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--pc-hover)] flex items-center justify-center mb-3">
                <FolderOpen size={24} className="text-pc-text-muted" />
              </div>
              <p className="text-sm text-pc-text-secondary font-medium">暂无资产</p>
              <p className="text-xs text-pc-text-muted mt-1">智能体生成的资产会显示在这里</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {assets.map((asset: AssetItem) => (
                  <button
                    key={asset.id}
                    onClick={() => handleSelectFile(asset)}
                    className={`w-full p-3 rounded-xl text-left transition-all relative ${
                      selectedFile?.id === asset.id
                        ? 'bg-[var(--pc-accent-glow)] border border-[var(--pc-accent-dim)]'
                        : 'bg-transparent border border-transparent hover:bg-[var(--pc-hover)]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${categoryColor(asset.category)}`}>
                        {categoryIcon(asset.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-pc-text font-medium truncate">{asset.display_name || asset.name}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-pc-text-muted">
                          <span className="flex items-center gap-0.5">
                            <Clock size={10} />
                            {formatTime(asset.created_at)}
                          </span>
                          <span>•</span>
                          <span className="uppercase">{asset.ext}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-pc-text-muted">{formatSize(asset.size_bytes)}</span>
                        <button
                          onClick={(e) => handleDeleteAsset(asset.id, e)}
                          className="p-1 rounded-lg text-pc-text-faint opacity-0 hover:opacity-100 hover:text-red-400 transition-all"
                          title="删除"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="flex-1 flex flex-col bg-[var(--pc-bg-surface)]">
          <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-pc-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${categoryColor(selectedFile.category)}`}>
                {categoryIcon(selectedFile.category, 14)}
              </div>
              <span className="text-sm font-medium text-pc-text truncate">{selectedFile.display_name || selectedFile.name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {downloading ? '下载中...' : '下载'}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
                删除
              </button>
              <button
                onClick={() => { setSelectedFile(null); setFileContent(null); if (htmlSrc) { URL.revokeObjectURL(htmlSrc); setHtmlSrc(null); } if (pdfSrc) { URL.revokeObjectURL(pdfSrc); setPdfSrc(null); } if (imgSrc) { URL.revokeObjectURL(imgSrc); setImgSrc(null); } }}
                className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden min-h-0">
            {getFileType(selectedFile) === 'markdown' && headers.length > 0 && (
              <div className="w-48 shrink-0 overflow-y-auto border-r border-pc-border p-4 space-y-2">
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
            <div className={`flex-1 min-w-0 min-h-0 relative ${getFileType(selectedFile) === 'html' ? 'h-full overflow-hidden bg-white' : 'overflow-y-auto'}`}>
              {getFileType(selectedFile) === 'markdown' ? (
                <div className="h-full w-full p-4 overflow-y-auto bg-[var(--pc-bg-base)] text-[var(--pc-text-primary)]">
                  <article className="prose prose-sm max-w-none">
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
              ) : getFileType(selectedFile) === 'html' ? (
                <iframe
                  src={htmlSrc || undefined}
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-scripts"
                  title={selectedFile.name}
                />
              ) : getFileType(selectedFile) === 'image' ? (
                <div className="flex items-center justify-center h-full p-4 bg-[var(--pc-bg-base)]">
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt={selectedFile.name}
                      className="max-w-full max-h-full object-contain rounded-xl"
                    />
                  )}
                </div>
              ) : getFileType(selectedFile) === 'video' ? (
                <div className="flex items-center justify-center h-full p-4">
                  <video
                    controls
                    className="max-w-full max-h-full rounded-xl"
                    src={`${apiClient.getBaseUrl().replace('/api', '')}/v1/admin/assets/${selectedFile.id}/download`}
                  />
                </div>
              ) : getFileType(selectedFile) === 'pdf' && pdfSrc ? (
                <iframe
                  src={pdfSrc}
                  className="w-full h-full border-0"
                  title={selectedFile.name}
                />
              ) : (
                <pre className="text-xs text-pc-text-muted whitespace-pre-wrap font-mono bg-[var(--pc-bg-base)] p-4 rounded-xl border border-pc-border">
                  {fileContent || '无法预览此文件类型'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedFile && (
        <div className="flex-1 hidden md:flex items-center justify-center bg-[var(--pc-bg-surface)]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--pc-hover)] flex items-center justify-center mx-auto mb-4">
              <ChevronRight size={32} className="text-pc-text-muted" />
            </div>
            <p className="text-sm text-pc-text-secondary font-medium">选择一个资产查看内容</p>
            <p className="text-xs text-pc-text-muted mt-1">点击左侧列表中的资产</p>
          </div>
        </div>
      )}
    </div>
  );
}