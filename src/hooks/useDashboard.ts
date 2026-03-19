import { useState, useEffect, useCallback, useRef } from 'react';
import { NanobotApiClient, type NanobotSession, type NanobotSkill, type NanobotChannelStatus } from '../lib/nanobotApi';

export interface DashboardData {
  sessions: NanobotSession[];
  skills: NanobotSkill[];
  channels: Record<string, NanobotChannelStatus>;
  cronJobs: CronJob[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  delete_after_run: boolean;
  schedule: {
    kind: string;
    expr?: string;
    tz?: string;
  };
  state: {
    next_run_at?: string;
    last_run_at?: string;
    last_status?: string;
  };
}

export function useDashboard(apiClient: NanobotApiClient | null) {
  const [data, setData] = useState<DashboardData>({
    sessions: [],
    skills: [],
    channels: {},
    cronJobs: [],
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const loadingRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!apiClient || loadingRef.current) return;
    loadingRef.current = true;
    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [sessionsRes, skillsRes, channelsRes, cronRes] = await Promise.allSettled([
        apiClient.getSessions(),
        apiClient.getSkills(),
        apiClient.getChannels(),
        apiClient.getCronJobs(),
      ]);

      const sessions = sessionsRes.status === 'fulfilled' && sessionsRes.value.applied
        ? sessionsRes.value.data.sessions : [];
      const skills = skillsRes.status === 'fulfilled' && skillsRes.value.applied
        ? skillsRes.value.data.skills : [];
      const channels = channelsRes.status === 'fulfilled' && channelsRes.value.applied
        ? channelsRes.value.data.channels : {};
      const cronJobs: CronJob[] = cronRes.status === 'fulfilled' && cronRes.value.applied
        ? cronRes.value.data.jobs : [];

      setData({
        sessions,
        skills,
        channels,
        cronJobs,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch dashboard data',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [apiClient]);

  const toggleSkill = useCallback(async (skillName: string, enabled: boolean) => {
    if (!apiClient) return;
    try {
      await apiClient.setSkillState(skillName, enabled);
      setData(prev => ({
        ...prev,
        skills: prev.skills.map(s =>
          s.name === skillName ? { ...s, enabled } : s
        ),
      }));
      return true;
    } catch {
      return false;
    }
  }, [apiClient]);

  const reloadConfig = useCallback(async () => {
    if (!apiClient) return;
    try {
      await apiClient.reloadConfig();
      await fetchAll();
      return true;
    } catch {
      return false;
    }
  }, [apiClient, fetchAll]);

  useEffect(() => {
    if (apiClient) {
      fetchAll();
      const interval = setInterval(fetchAll, 30000);
      return () => clearInterval(interval);
    }
  }, [apiClient, fetchAll]);

  return { data, fetchAll, toggleSkill, reloadConfig };
}
