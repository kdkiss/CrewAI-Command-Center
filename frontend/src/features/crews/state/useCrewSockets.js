import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { createLogDeduplicator, normalizeLogLevel } from './crewUtils';
import { getApiErrorMessage, isLikelyNetworkError } from '../../../utils/apiErrorUtils';

const CREW_LOG_EVENT = 'crew_log';
const ACTIVITY_HISTORY_EVENT = 'activity_history';
const MAX_ACTIVITY_ITEMS = 250;

const useCrewSockets = ({
  socket,
  apiBase,
  addToast,
  setCrewError,
  setCrews,
  setSelectedCrew,
  setRunningCrews,
  setPendingStarts,
  setPendingStops,
  setCrewLogs,
  crewsRef,
  selectedCrewRef
}) => {
  const [activityItems, setActivityItems] = useState([]);
  const logDeduplicator = useRef(createLogDeduplicator()).current;
  const seenHistoryIdsRef = useRef(new Set());

  const resolveCrewName = useCallback((crewId) => {
    if (crewId == null) {
      return null;
    }

    const stringCrewId = String(crewId);
    const crew = crewsRef.current?.find(item => String(item.id) === stringCrewId);
    return crew?.name ?? stringCrewId;
  }, [crewsRef]);

  const appendActivityItem = useCallback((item) => {
    if (!item) {
      return;
    }

    const timestamp = item.timestamp instanceof Date
      ? item.timestamp
      : new Date(item.timestamp ?? Date.now());
    const normalizedType = item.type || 'system';
    const stringCrewId = item.crewId != null ? String(item.crewId) : null;
    const crewName = item.crewName ?? (stringCrewId ? resolveCrewName(stringCrewId) : null);

    const normalizedItem = {
      id: item.id || `${timestamp.getTime()}-${normalizedType}-${stringCrewId || 'global'}-${Math.random().toString(16).slice(2)}`,
      timestamp,
      type: normalizedType,
      crewId: stringCrewId,
      crewName,
      level: item.level ? String(item.level).toLowerCase() : null,
      agent: item.agent || null,
      action: item.action || null,
      message: item.message || '',
      details: item.details || null,
      metadata: item.metadata || {}
    };

    setActivityItems(prev => {
      const next = [...prev, normalizedItem];
      return next.length > MAX_ACTIVITY_ITEMS ? next.slice(next.length - MAX_ACTIVITY_ITEMS) : next;
    });
  }, [resolveCrewName]);

  const applyCrewLog = useCallback((log, { skipRuntimeDedup = false } = {}) => {
    if (!log || typeof log !== 'object') {
      return;
    }

    const normalizedLog = {
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      level: log.level || 'info',
      agent: log.agent || 'system',
      crewId: log.crewId ?? log.crew_id ?? log.crew,
      message: typeof log.message === 'string' ? log.message : JSON.stringify(log),
      category: log.category || null,
      operation_id: log.operationId || null,
      sequence: log.sequence || null,
      is_duplicate: log.isDuplicate || false,
      duplicate_count: log.duplicateCount || 0,
      operation_status: log.operationStatus || null,
      total_steps: log.totalSteps || null
    };

    if (!skipRuntimeDedup && !normalizedLog.is_duplicate) {
      const isDuplicate = logDeduplicator({
        agent: normalizedLog.agent,
        message: normalizedLog.message
      });

      if (isDuplicate) {
        return;
      }
    }

    const stringCrewId = normalizedLog.crewId != null ? String(normalizedLog.crewId) : null;

    if (stringCrewId && normalizedLog.is_duplicate && normalizedLog.operation_id) {
      setCrewLogs(prev => {
        const crewLogs = prev[stringCrewId] || [];
        const updatedLogs = crewLogs.map(existingLog => {
          if (existingLog.operation_id === normalizedLog.operation_id && existingLog.sequence === normalizedLog.sequence) {
            return {
              ...existingLog,
              is_duplicate: true,
              duplicate_count: normalizedLog.duplicate_count
            };
          }
          return existingLog;
        });

        return {
          ...prev,
          [stringCrewId]: updatedLogs
        };
      });
    } else if (stringCrewId) {
      setCrewLogs(prev => ({
        ...prev,
        [stringCrewId]: [...(prev[stringCrewId] || []), normalizedLog]
      }));
    }

    if (!normalizedLog.is_duplicate) {
      const normalizedLevel = normalizeLogLevel(normalizedLog.level) || normalizedLog.level;
      appendActivityItem({
        type: 'log',
        crewId: stringCrewId,
        level: normalizedLevel,
        agent: normalizedLog.agent,
        message: normalizedLog.message,
        details: normalizedLog.category ? { category: normalizedLog.category } : null,
        metadata: {
          operationId: normalizedLog.operation_id || undefined,
          operationStatus: normalizedLog.operation_status || undefined,
          sequence: normalizedLog.sequence || undefined,
          totalSteps: normalizedLog.total_steps || undefined
        },
        timestamp: normalizedLog.timestamp
      });
    }
  }, [appendActivityItem, logDeduplicator, setCrewLogs]);

  const applyCrewStarted = useCallback(({ crew_id: rawCrewId }) => {
    const stringCrewId = rawCrewId != null ? String(rawCrewId) : null;
    if (!stringCrewId) {
      return;
    }

    setRunningCrews(prev => {
      const next = new Set(prev);
      next.add(stringCrewId);
      return next;
    });
    setPendingStarts(prev => {
      if (!prev.has(stringCrewId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(stringCrewId);
      return next;
    });
    setCrewError(null);

    appendActivityItem({
      type: 'lifecycle',
      crewId: stringCrewId,
      action: 'started',
      message: `${resolveCrewName(stringCrewId) || `Crew ${stringCrewId}`} started.`,
      level: 'success',
      timestamp: new Date()
    });
  }, [appendActivityItem, resolveCrewName, setCrewError, setPendingStarts, setRunningCrews]);

  const applyCrewStopped = useCallback(({ crew_id: rawCrewId }) => {
    const stringCrewId = rawCrewId != null ? String(rawCrewId) : null;
    if (!stringCrewId) {
      return;
    }

    setRunningCrews(prev => {
      if (!prev.has(stringCrewId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(stringCrewId);
      return next;
    });
    setPendingStops(prev => {
      if (!prev.has(stringCrewId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(stringCrewId);
      return next;
    });
    setPendingStarts(prev => {
      if (!prev.has(stringCrewId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(stringCrewId);
      return next;
    });

    appendActivityItem({
      type: 'lifecycle',
      crewId: stringCrewId,
      action: 'stopped',
      message: `${resolveCrewName(stringCrewId) || `Crew ${stringCrewId}`} stopped.`,
      level: 'info',
      timestamp: new Date()
    });
  }, [appendActivityItem, resolveCrewName, setPendingStarts, setPendingStops, setRunningCrews]);

  const processHistoryEntry = useCallback((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const entryId = entry.id != null ? String(entry.id) : null;
    if (entryId) {
      if (seenHistoryIdsRef.current.has(entryId)) {
        return;
      }
      seenHistoryIdsRef.current.add(entryId);
    }

    const payload = entry.data && typeof entry.data === 'object' ? entry.data : {};
    switch (entry.type) {
      case 'crew_log':
        applyCrewLog(payload, { skipRuntimeDedup: true });
        break;
      case 'crew_started':
        applyCrewStarted(payload);
        break;
      case 'crew_stopped':
        applyCrewStopped(payload);
        break;
      default:
        break;
    }
  }, [applyCrewLog, applyCrewStarted, applyCrewStopped]);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${apiBase}/activity`);
        const events = Array.isArray(response?.data?.events) ? response.data.events : [];
        events.forEach((entry) => {
          if (!cancelled) {
            processHistoryEntry(entry);
          }
        });
      } catch (error) {
        console.error('Failed to load activity history', error);
        const message = getApiErrorMessage(error, {
          defaultMessage: 'Failed to load activity history.',
          apiBase
        });

        appendActivityItem({
          type: 'system',
          level: 'error',
          action: 'activity-history',
          message,
          timestamp: new Date()
        });

        if (isLikelyNetworkError(error)) {
          addToast({
            title: 'Connection Error',
            message,
            type: 'error'
          });
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [apiBase, processHistoryEntry, appendActivityItem, addToast]);

  useEffect(() => {
    const handleCrewLog = (log) => {
      applyCrewLog(log);
    };

    const normalizeCrew = (crew) => {
      if (!crew || typeof crew !== 'object') {
        return null;
      }

      const crewId = crew.id ?? crew.crew_id ?? crew.crewId ?? null;
      if (!crewId) {
        return null;
      }

      return {
        ...crew,
        id: String(crewId),
        agents: Array.isArray(crew.agents) ? crew.agents : [],
        tasks: Array.isArray(crew.tasks) ? crew.tasks : [],
        inputs: crew.inputs && typeof crew.inputs === 'object' ? crew.inputs : {}
      };
    };

    const handleCrewsUpdated = (updatedCrews) => {
      if (!Array.isArray(updatedCrews)) {
        return;
      }

      const normalizedCrews = updatedCrews
        .map(normalizeCrew)
        .filter(Boolean);

      const mergedCrews = normalizedCrews.map(crew => {
        const existing = crewsRef.current?.find(item => item.id === crew.id);
        return existing ? { ...existing, ...crew } : crew;
      });

      setCrews(mergedCrews);

      appendActivityItem({
        type: 'system',
        action: 'synchronized',
        message: 'Crew catalog synchronized with server.',
        level: 'info',
        timestamp: new Date()
      });

      const currentSelectedId = selectedCrewRef.current?.id ? String(selectedCrewRef.current.id) : null;
      if (mergedCrews.length === 0) {
        if (selectedCrewRef.current !== null) {
          setSelectedCrew(null);
        }
        return;
      }

      if (currentSelectedId) {
        const matchingCrew = mergedCrews.find(crew => crew.id === currentSelectedId);
        if (matchingCrew) {
          setSelectedCrew(prev => {
            if (prev && prev.id === matchingCrew.id) {
              return { ...prev, ...matchingCrew };
            }
            return matchingCrew;
          });
          return;
        }
      }

      setSelectedCrew(prev => {
        if (prev && prev.id === mergedCrews[0].id) {
          return { ...prev, ...mergedCrews[0] };
        }
        return mergedCrews[0];
      });
    };

    const handleCrewUpdated = (updatedCrew) => {
      const normalizedCrew = normalizeCrew(updatedCrew);
      if (!normalizedCrew) {
        return;
      }

      setCrews(prevCrews => {
        const existingIndex = prevCrews.findIndex(crew => crew.id === normalizedCrew.id);
        if (existingIndex === -1) {
          return [...prevCrews, normalizedCrew];
        }

        const nextCrews = [...prevCrews];
        nextCrews[existingIndex] = { ...nextCrews[existingIndex], ...normalizedCrew };
        return nextCrews;
      });

      if (selectedCrewRef.current?.id && String(selectedCrewRef.current.id) === normalizedCrew.id) {
        setSelectedCrew(prev => (prev ? { ...prev, ...normalizedCrew } : normalizedCrew));
      }

      appendActivityItem({
        type: 'lifecycle',
        crewId: normalizedCrew.id,
        action: 'updated',
        message: `${normalizedCrew.name || normalizedCrew.id} was updated.`,
        level: 'info',
        timestamp: new Date()
      });
    };

    const handleCrewStarted = (payload) => {
      applyCrewStarted(payload);
    };

    const handleCrewStopped = (payload) => {
      applyCrewStopped(payload);
    };

    const handleCrewError = ({ crew_id: crewId, error }) => {
      const stringCrewId = String(crewId);
      setPendingStarts(prev => {
        if (!prev.has(stringCrewId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(stringCrewId);
        return next;
      });
      setPendingStops(prev => {
        if (!prev.has(stringCrewId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(stringCrewId);
        return next;
      });
      setCrewError(typeof error === 'string' ? error : 'An unknown error occurred while running the crew.');
      addToast({
        title: 'Crew Error',
        message: typeof error === 'string' ? error : 'An unknown error occurred while running the crew.',
        type: 'error'
      });

      appendActivityItem({
        type: 'lifecycle',
        crewId: stringCrewId,
        action: 'error',
        message: typeof error === 'string' ? error : 'An unknown error occurred while running the crew.',
        level: 'error',
        timestamp: new Date()
      });
    };

    const handleActivityHistory = (entries) => {
      if (!Array.isArray(entries)) {
        return;
      }
      entries.forEach(entry => {
        processHistoryEntry(entry);
      });
    };

    socket.on(CREW_LOG_EVENT, handleCrewLog);
    socket.on('crews_updated', handleCrewsUpdated);
    socket.on('crew_updated', handleCrewUpdated);
    socket.on('crew_started', handleCrewStarted);
    socket.on('crew_stopped', handleCrewStopped);
    socket.on('crew_error', handleCrewError);
    socket.on(ACTIVITY_HISTORY_EVENT, handleActivityHistory);

    return () => {
      socket.off(CREW_LOG_EVENT, handleCrewLog);
      socket.off('crews_updated', handleCrewsUpdated);
      socket.off('crew_updated', handleCrewUpdated);
      socket.off('crew_started', handleCrewStarted);
      socket.off('crew_stopped', handleCrewStopped);
      socket.off('crew_error', handleCrewError);
      socket.off(ACTIVITY_HISTORY_EVENT, handleActivityHistory);
    };
  }, [
    addToast,
    applyCrewLog,
    applyCrewStarted,
    applyCrewStopped,
    appendActivityItem,
    crewsRef,
    processHistoryEntry,
    selectedCrewRef,
    setCrewError,
    setCrews,
    setPendingStarts,
    setPendingStops,
    setSelectedCrew,
    socket
  ]);

  return {
    activityItems,
    appendActivityItem,
    applyCrewLog
  };
};

export default useCrewSockets;
