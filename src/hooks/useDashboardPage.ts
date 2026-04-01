import { useState, useEffect, useCallback, useRef } from 'react';
import { NanobotApiClient, type NanobotSession, type NanobotSkill, type NanobotChannelStatus, type CronJob, type CronJobPayload, type CronLogEntry, type HealthReport } from '../lib/nanobotApi';

export interface DashboardData {
  sessions: NanobotSession[];
  skills: NanobotSkill[];
  channels: Record<string, NanobotChannelStatus>;
  cronJobs: CronJob[];
  cronLogs: Record<string, CronLogEntry[]>;
  health: HealthReport | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useDashboardPage(apiClient: NanobotApiClient | null) {
  const [data, setData] = useState<DashboardData>({
    sessions: [],
    skills: [],
    channels: {},
    cronJobs: [],
    cronLogs: {},
    health: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const loadingRef = useRef(false);

  const fetchHealth = useCallback(async () => {
    if (!apiClient) return;
    try {
      const health = await apiClient.healthCheck();
      setData(prev => ({ ...prev, health }));
    } catch {
      setData(prev => ({
        ...prev,
        health: {
          overall: 'unhealthy',
          services: [],
          checkedAt: new Date().toISOString(),
        },
      }));
    }
  }, [apiClient]);

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
        cronLogs: data.cronLogs,
        health: data.health,
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
  }, [apiClient, data.cronLogs]);

  const fetchCronLogs = useCallback(async (jobId: string) => {
    if (!apiClient) return;
    try {
      const res = await apiClient.getCronJobLogs(jobId, 50);
      if (res.applied && res.data.logs) {
        setData(prev => ({
          ...prev,
          cronLogs: {
            ...prev.cronLogs,
            [jobId]: res.data.logs,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to fetch cron logs:', err);
    }
  }, [apiClient]);

  const toggleSkill = useCallback(async (skillName: string, enabled: boolean) => {
    if (!apiClient) return false;
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

  const addCronJob = useCallback(async (payload: CronJobPayload) => {
    if (!apiClient) return false;
    try {
      const res = await apiClient.addCronJob(payload);
      if (res.applied && res.data.job) {
        setData(prev => ({
          ...prev,
          cronJobs: [...prev.cronJobs, res.data.job!],
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [apiClient]);

  const toggleCronJob = useCallback(async (jobId: string, enabled: boolean) => {
    if (!apiClient) return false;
    try {
      setData(prev => ({
        ...prev,
        cronJobs: prev.cronJobs.map(j => j.id === jobId ? { ...j, enabled } : j),
      }));
      return true;
    } catch {
      return false;
    }
  }, [apiClient]);

  const deleteCronJob = useCallback(async (jobId: string) => {
    if (!apiClient) return false;
    try {
      await apiClient.deleteCronJob(jobId);
      setData(prev => ({
        ...prev,
        cronJobs: prev.cronJobs.filter(j => j.id !== jobId),
      }));
      return true;
    } catch {
      return false;
    }
  }, [apiClient]);

  useEffect(() => {
    if (apiClient) {
      fetchAll();
      fetchHealth();
      const interval = setInterval(() => { fetchAll(); fetchHealth(); }, 30000);
      return () => clearInterval(interval);
    }
  }, [apiClient, fetchAll, fetchHealth]);

  return { data, fetchAll, fetchHealth, fetchCronLogs, toggleSkill, toggleCronJob, reloadConfig, addCronJob, deleteCronJob };
}