import { useState, useMemo, useEffect } from 'react';
import { X, Search, FileText, Download, Copy, Clock, FolderOpen, ChevronRight } from 'lucide-react';
import { LazyMarkdown } from '../LazyMarkdown';
import { HtmlPreview } from '../HtmlPreview';

interface GeneratedFile {
  id: string;
  name: string;
  type: 'markdown' | 'html' | 'other';
  content: string;
  size: number;
  sessionId: string;
  sessionName: string;
  createdAt: string;
}

interface Props {
  onClose: () => void;
}

const DOC_FILES = [
  { name: 'DASHBOARD_DESIGN.md', sessionName: 'Dashboard 设计讨论' },
  { name: 'NANOBOT_ADAPTER.md', sessionName: 'Nanobot 适配器开发' },
  { name: 'NANOBOT_COMPLETION.md', sessionName: 'Nanobot 补全功能' },
  { name: 'TODO-CronJob-API.md', sessionName: '定时任务 API 开发' },
  { name: '智能体群管理平台 PRD.md', sessionName: '智能体编排 PRD' },
  { name: '历史文件查看器 PRD.md', sessionName: '历史文件 PRD' },
];

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

export function HistoryFilesPage({ onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'markdown' | 'other'>('all');
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => {
    if (selectedFile?.type !== 'markdown') return [];
    return parseHeaders(selectedFile.content);
  }, [selectedFile]);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const loadedFiles: GeneratedFile[] = await Promise.all(
          DOC_FILES.map(async (file) => {
            const response = await fetch(`/doc/${file.name}`);
            const content = await response.text();
            const isHtml = file.name.endsWith('.html');
            return {
              id: file.name,
              name: file.name,
              type: isHtml ? 'html' : file.name.endsWith('.md') ? 'markdown' : 'other',
              content: isHtml ? '' : content,
              size: new Blob([content]).size,
              sessionId: file.sessionName,
              sessionName: file.sessionName,
              createdAt: new Date().toISOString(),
            };
          })
        );
        setFiles(loadedFiles);
      } catch (error) {
        console.error('Failed to load files:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, []);

  const filteredFiles = useMemo(() => {
    return files.filter((file: GeneratedFile) => {
      const matchSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === 'all' || file.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [files, searchQuery, typeFilter]);

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

  const handleCopy = async () => {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
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
                  <FileText size={16} className="text-pc-accent" />
                </div>
              </div>
              <div>
                <h1 className="font-semibold text-pc-text text-sm">历史文件</h1>
                <p className="text-[10px] text-pc-text-muted">查看对话生成的文件</p>
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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="flex-1 bg-[var(--pc-bg-surface)] text-xs text-pc-text-secondary rounded-lg px-2 py-1.5 border border-pc-border outline-none cursor-pointer"
              >
                <option value="all">全部类型</option>
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
                <option value="other">其他文件</option>
              </select>
              <span className="text-xs text-pc-text-muted">{filteredFiles.length} 个文件</span>
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
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--pc-hover)] flex items-center justify-center mb-3">
                <FolderOpen size={24} className="text-pc-text-muted" />
              </div>
              <p className="text-sm text-pc-text-secondary font-medium">暂无文件</p>
              <p className="text-xs text-pc-text-muted mt-1">在对话中生成的文件会显示在这里</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedFile?.id === file.id
                      ? 'bg-[var(--pc-accent-glow)] border border-[var(--pc-accent-dim)]'
                      : 'bg-transparent border border-transparent hover:bg-[var(--pc-hover)]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      file.type === 'markdown' ? 'bg-blue-500/15' : file.type === 'html' ? 'bg-emerald-500/15' : 'bg-zinc-500/15'
                    }`}>
                      <FileText size={14} className={file.type === 'markdown' ? 'text-blue-400' : file.type === 'html' ? 'text-emerald-400' : 'text-zinc-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-pc-text font-medium truncate">{file.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-pc-text-muted">
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          {formatTime(file.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[100px]">{file.sessionName}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-pc-text-muted shrink-0">{formatSize(file.size)}</span>
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
              <FileText size={16} className="text-pc-accent shrink-0" />
              <span className="text-sm font-medium text-pc-text truncate">{selectedFile.name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
              >
                <Copy size={12} />
                复制
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
              >
                <Download size={12} />
                下载
              </button>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {selectedFile.type === 'markdown' && headers.length > 0 && (
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
            
            <div className={`flex-1 ${selectedFile.type === 'html' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              {selectedFile.type === 'markdown' ? (
                <div className="h-full w-full p-4 overflow-y-auto">
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <LazyMarkdown components={{
                    h1: ({ node, ...props }) => <h1 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                    h2: ({ node, ...props }) => <h2 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                    h3: ({ node, ...props }) => <h3 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                    h4: ({ node, ...props }) => <h4 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                    h5: ({ node, ...props }) => <h5 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                    h6: ({ node, ...props }) => <h6 {...props} id={props.children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')} />,
                  }}>{selectedFile.content}</LazyMarkdown>
                </article>
                </div>
              ) : selectedFile.type === 'html' ? (
                <HtmlPreview filePath={selectedFile.name} fullHeight={true} />
              ) : (
                <pre className="text-xs text-pc-text-muted whitespace-pre-wrap font-mono bg-[var(--pc-bg-base)] p-4 rounded-xl border border-pc-border">
                  {selectedFile.content}
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
            <p className="text-sm text-pc-text-secondary font-medium">选择一个文件查看内容</p>
            <p className="text-xs text-pc-text-muted mt-1">点击左侧列表中的文件</p>
          </div>
        </div>
      )}
    </div>
  );
}
