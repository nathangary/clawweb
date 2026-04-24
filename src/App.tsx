import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useGateway } from './hooks/useGateway';
import { useSecondarySession } from './hooks/useSecondarySession';
import { useNotifications, setBaseTitle } from './hooks/useNotifications';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { ConnectionBanner } from './components/ConnectionBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { ToolCollapseProvider } from './contexts/ToolCollapseContext';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { SkillHubPage } from './components/SkillHub/SkillHubPage';
import { AgentOrchestratorPage } from './components/AgentOrchestrator/AgentOrchestratorPage';
import { HistoryFilesPage } from './components/HistoryFiles/HistoryFilesPage';
import { AgentAssetsPage } from './components/AgentAssets/AgentAssetsPage';
import { TasksPage } from './components/Tasks/TasksPage';
import { WorkspacePage } from './components/Workspace/WorkspacePage';
import { sessionDisplayName, extractAgentIdFromKey, formatAgentId } from './lib/sessionName';
import { X } from 'lucide-react';
import { useT } from './hooks/useLocale';
import { useSwipeSidebar } from './hooks/useSwipeSidebar';

const Chat = lazy(() => import('./components/Chat').then(m => ({ default: m.Chat })));

const SPLIT_WIDTH_KEY = 'pinchchat-split-width';
const MIN_SPLIT = 250;

function getSavedSplitRatio(): number {
  try {
    const v = localStorage.getItem(SPLIT_WIDTH_KEY);
    if (v) { const n = Number(v); if (n >= 20 && n <= 80) return n; }
  } catch { /* noop */ }
  return 50;
}

export default function App() {
  const {
    status, messages, sessions, activeSession, isGenerating, isLoadingHistory,
    sendMessage, abort, switchSession, createNewSession, deleteSession,
    authenticated, login, logout, connectError, isConnecting,
    getClient, getApiClient,
  } = useGateway();
  const [splitSession, setSplitSession] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(getSavedSplitRatio);
  const [splitDragging, setSplitDragging] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [skillHubOpen, setSkillHubOpen] = useState(false);
  const [agentOrchestratorOpen, setAgentOrchestratorOpen] = useState(false);
  const [historyFilesOpen, setHistoryFilesOpen] = useState(false);
  const [agentAssetsOpen, setAgentAssetsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitRatioRef = useRef(splitRatio);
  const secondary = useSecondarySession(getClient, splitSession);
  const t = useT();
  const handleSplit = useCallback((key: string) => {
    setSplitSession(prev => prev === key ? null : key);
  }, []);

  useEffect(() => {
    if (!splitDragging) return;
    const onMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const total = rect.width;
      if (total < MIN_SPLIT * 2) return;
      const x = e.clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (x / total) * 100));
      setSplitRatio(pct);
      splitRatioRef.current = pct;
    };
    const onUp = () => {
      setSplitDragging(false);
      localStorage.setItem(SPLIT_WIDTH_KEY, String(Math.round(splitRatioRef.current)));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [splitDragging, splitRatio]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useSwipeSidebar(sidebarOpen, () => setSidebarOpen(true), () => setSidebarOpen(false));
  const { notify, soundEnabled, toggleSound } = useNotifications();
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messages.length > prevCount) {
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant' && !last.isStreaming) {
        const preview = last.content?.slice(0, 100) || 'New message';
        notify('伯俊Claw', preview);
      }
    }
  }, [messages, notify]);

  useEffect(() => {
    const session = sessions.find(s => s.key === activeSession);
    setBaseTitle(session?.label || session?.key);
    return () => setBaseTitle(undefined);
  }, [activeSession, sessions]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && sidebarOpen) {
      setSidebarOpen(false);
    }
    if (e.key === 'Escape' && dashboardOpen) {
      setDashboardOpen(false);
    }
    if (e.key === 'Escape' && skillHubOpen) {
      setSkillHubOpen(false);
    }
    if (e.key === 'Escape' && tasksOpen) {
      setTasksOpen(false);
    }
    if (e.key === 'Escape' && workspaceOpen) {
      setWorkspaceOpen(false);
    }
    if (e.key === '?' && !shortcutsOpen) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setShortcutsOpen(true);
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (sessions.length < 2) return;
      const idx = sessions.findIndex(s => s.key === activeSession);
      if (idx === -1) return;
      const next = e.key === 'ArrowUp'
        ? (idx - 1 + sessions.length) % sessions.length
        : (idx + 1) % sessions.length;
      switchSession(sessions[next].key);
    }
  }, [sidebarOpen, shortcutsOpen, sessions, activeSession, switchSession, dashboardOpen, skillHubOpen, tasksOpen, workspaceOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const sessionAgentId = activeSession ? extractAgentIdFromKey(activeSession) : null;
  const agentName = sessionAgentId ? formatAgentId(sessionAgentId) || sessionAgentId : undefined;

  if (authenticated === null) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[var(--pc-bg-base)] text-pc-text-muted">
        <div className="animate-pulse text-sm">Connecting…</div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onConnect={login} error={connectError} isConnecting={isConnecting} />;
  }

  return (
    <>
    <ToolCollapseProvider>
    <div className="h-dvh flex overflow-x-hidden bg-[var(--pc-bg-base)] text-pc-text bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.02),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.04),transparent_50%)]" role="application" aria-label="伯俊Claw">
      <a href="#chat-input" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-pc-accent focus:text-white focus:text-sm focus:font-medium">{t('app.skipToChat')}</a>
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSwitch={switchSession}
        onDelete={deleteSession}
        onSplit={handleSplit}
        splitSession={splitSession}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onRename={() => Promise.resolve(false)}
        onNewSession={createNewSession}
        onNewSessionForAgent={() => Promise.resolve()}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenSkillHub={() => setSkillHubOpen(true)}
        onOpenAgentOrchestrator={() => setAgentOrchestratorOpen(true)}
        onOpenHistoryFiles={() => setHistoryFilesOpen(true)}
        onOpenAgentAssets={() => setAgentAssetsOpen(true)}
        onOpenTasks={() => setTasksOpen(true)}
        onOpenWorkspace={() => setWorkspaceOpen(true)}
      />
      <div ref={splitContainerRef} className="flex-1 flex min-w-0" aria-hidden={sidebarOpen ? true : undefined}>
        <main className="flex flex-col min-w-0" style={splitSession ? { width: `${splitRatio}%` } : { flex: 1 }} aria-label={t('app.mainChat')}>
          <Header status={status} sessionKey={activeSession} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} activeSessionData={sessions.find(s => s.key === activeSession)} onLogout={logout} soundEnabled={soundEnabled} onToggleSound={toggleSound} messages={messages} agentAvatarUrl={undefined} agentName={agentName} onCompact={() => Promise.resolve(false)} />
          <ConnectionBanner status={status} />
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-pc-text-muted"><div className="animate-pulse text-sm">Loading…</div></div>}>
            <Chat messages={messages} isGenerating={isGenerating} isLoadingHistory={isLoadingHistory} status={status} sessionKey={activeSession} onSend={sendMessage} onNewSession={createNewSession} onAbort={abort} agentAvatarUrl={undefined} agentName={agentName} />
          </Suspense>
        </main>
        {splitSession && (
          <>
            <div
              className={`w-1 cursor-col-resize flex-shrink-0 transition-colors ${splitDragging ? 'bg-pc-accent/60' : 'bg-pc-border hover:bg-pc-accent/40'}`}
              onMouseDown={() => setSplitDragging(true)}
              role="separator"
              aria-orientation="vertical"
            />
            <section className="flex flex-col min-w-0" style={{ width: `${100 - splitRatio}%` }} aria-label={t('app.splitPane')}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-pc-border bg-[var(--pc-bg-surface)]">
                <span className="text-sm font-medium text-pc-text truncate flex-1">
                  {(() => { const s = sessions.find(s => s.key === splitSession); return s ? sessionDisplayName(s) : splitSession; })()}
                </span>
                <button
                  onClick={() => setSplitSession(null)}
                  className="p-1 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
                  title={t('split.close')}
                  aria-label={t('split.close')}
                >
                  <X size={14} />
                </button>
              </div>
              <Suspense fallback={<div className="flex-1 flex items-center justify-center text-pc-text-muted"><div className="animate-pulse text-sm">Loading…</div></div>}>
                <Chat messages={secondary.messages} isGenerating={secondary.isGenerating} isLoadingHistory={secondary.isLoadingHistory} status={status} sessionKey={splitSession} onSend={secondary.sendMessage} onNewSession={createNewSession} onAbort={secondary.abort} agentAvatarUrl={undefined} agentName={undefined} />
              </Suspense>
            </section>
          </>
        )}
      </div>
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    {dashboardOpen && (
      <ErrorBoundary>
        <DashboardPage
          apiClient={getApiClient()}
          onClose={() => setDashboardOpen(false)}
          onOpenSkillMarket={() => { setDashboardOpen(false); setSkillHubOpen(true); }}
          onOpenTasks={() => { setDashboardOpen(false); setTasksOpen(true); }}
        />
      </ErrorBoundary>
    )}
    </div>
    </ToolCollapseProvider>
    {skillHubOpen && (
      <ErrorBoundary>
        <SkillHubPage onClose={() => setSkillHubOpen(false)} />
      </ErrorBoundary>
    )}
    {agentOrchestratorOpen && (
      <ErrorBoundary>
        <AgentOrchestratorPage onClose={() => { switchSession('transport:web'); setAgentOrchestratorOpen(false); }} getClient={getClient} getApiClient={getApiClient} />
      </ErrorBoundary>
    )}
    {historyFilesOpen && getApiClient() && (
      <ErrorBoundary>
        <HistoryFilesPage onClose={() => setHistoryFilesOpen(false)} apiClient={getApiClient()!} />
      </ErrorBoundary>
    )}
    {agentAssetsOpen && getApiClient() && (
      <ErrorBoundary>
        <AgentAssetsPage onClose={() => setAgentAssetsOpen(false)} apiClient={getApiClient()!} />
      </ErrorBoundary>
    )}
    {tasksOpen && (
      <ErrorBoundary>
        <TasksPage apiClient={getApiClient()} onClose={() => setTasksOpen(false)} />
      </ErrorBoundary>
    )}
    {workspaceOpen && (
      <ErrorBoundary>
        <WorkspacePage onClose={() => setWorkspaceOpen(false)} />
      </ErrorBoundary>
    )}
    </>
  );
}
