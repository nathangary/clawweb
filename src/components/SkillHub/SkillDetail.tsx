import { useState } from 'react';
import { X, Star, Download, ExternalLink, Check, Sparkles } from 'lucide-react';
import type { Skill } from '../../types/skill';

interface Props {
  skill: Skill;
  onClose: () => void;
  onInstall?: (skillId: string, config: Record<string, unknown>) => void;
}

export function SkillDetail({ skill, onClose, onInstall }: Props) {
  const [config, setConfig] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    skill.configSchema?.forEach(field => {
      initial[field.name] = field.default;
    });
    return initial;
  });
  const [installed, setInstalled] = useState(false);

  const handleInstall = () => {
    onInstall?.(skill.id, config);
    setInstalled(true);
    setTimeout(() => {
      onClose();
      setInstalled(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--pc-bg-base)] border border-pc-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-pc-border">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{skill.icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-pc-text">{skill.name}</h2>
                {skill.isOfficial && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--pc-accent-glow)] text-[10px] font-medium text-[var(--pc-accent)]">
                    <Sparkles size={10} />
                    官方认证
                  </span>
                )}
              </div>
              <p className="text-xs text-pc-text-muted mt-0.5">{skill.author} · v{skill.version}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star size={14} className="text-amber-400 fill-amber-400" />
              <span className="text-sm font-medium text-pc-text">{skill.rating > 0 ? skill.rating.toFixed(1) : '-'}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-pc-text-muted">
              <Download size={14} />
              <span>{skill.installCount.toLocaleString()} 安装</span>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-[var(--pc-bg-elevated)] text-xs text-pc-text-muted">
              {skill.category}
            </span>
          </div>

          <div>
            <p className="text-sm text-pc-text-secondary leading-relaxed">{skill.description}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-lg bg-[var(--pc-bg-elevated)] text-xs text-pc-text-muted">
                {tag}
              </span>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-pc-text mb-3">功能特点</h3>
            <ul className="space-y-2">
              {skill.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-pc-text-secondary">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--pc-accent)] shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {skill.configSchema && skill.configSchema.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-pc-text mb-3">配置参数</h3>
              <div className="space-y-3 bg-[var(--pc-bg-surface)] rounded-xl p-4 border border-pc-border">
                {skill.configSchema.map(field => (
                  <div key={field.name}>
                    <label className="flex items-center gap-1 text-xs text-pc-text-secondary mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.type === 'string' && (
                      <input
                        type="text"
                        value={(config[field.name] as string) || ''}
                        onChange={e => setConfig(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-sm text-pc-text outline-none focus:ring-1 focus:ring-[var(--pc-accent-dim)] transition-all"
                      />
                    )}
                    {field.type === 'number' && (
                      <input
                        type="number"
                        value={(config[field.name] as number) || 0}
                        onChange={e => setConfig(prev => ({ ...prev, [field.name]: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-sm text-pc-text outline-none focus:ring-1 focus:ring-[var(--pc-accent-dim)] transition-all"
                      />
                    )}
                    {field.type === 'boolean' && (
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          config[field.name]
                            ? 'bg-[var(--pc-accent-glow)] text-[var(--pc-accent)] border border-[var(--pc-accent-dim)]'
                            : 'bg-[var(--pc-bg-base)] text-pc-text-muted border border-pc-border'
                        }`}
                      >
                        {config[field.name] ? '已启用' : '未启用'}
                      </button>
                    )}
                    {field.type === 'select' && (
                      <select
                        value={(config[field.name] as string) || ''}
                        onChange={e => setConfig(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-sm text-pc-text outline-none focus:ring-1 focus:ring-[var(--pc-accent-dim)] transition-all"
                      >
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {field.description && (
                      <p className="text-[11px] text-pc-text-faint mt-1">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {skill.docsUrl && (
            <a
              href={skill.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--pc-accent)] hover:underline"
            >
              <ExternalLink size={14} />
              查看完整文档
            </a>
          )}
        </div>

        <div className="p-5 border-t border-pc-border bg-[var(--pc-bg-surface)]/50">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-pc-border text-sm text-pc-text-secondary hover:bg-[var(--pc-hover)] transition-colors"
            >
              关闭
            </button>
            <button
              onClick={handleInstall}
              disabled={installed}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                installed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--pc-accent)] text-zinc-900 hover:opacity-90 shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.25)]'
              }`}
            >
              {installed ? (
                <span className="flex items-center gap-1.5">
                  <Check size={14} />
                  已安装
                </span>
              ) : (
                '安装'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
