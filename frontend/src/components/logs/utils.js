export const createDefaultLogFilters = () => ({
  level: 'all',
  agent: 'all',
  category: 'all',
  timeRange: 'all',
  search: ''
});

export const filterLogs = (logs = [], filters = createDefaultLogFilters()) => {
  const now = Date.now();

  return logs.filter(log => {
    if (!log) {
      return false;
    }

    if (filters.level !== 'all' && log.level !== filters.level) {
      return false;
    }

    if (filters.agent !== 'all' && log.agent !== filters.agent) {
      return false;
    }

    if (filters.category !== 'all' && log.category !== filters.category) {
      return false;
    }

    if (filters.timeRange !== 'all') {
      const logTime = new Date(log.timestamp).getTime();

      if (!Number.isNaN(logTime)) {
        const diff = now - logTime;

        if (filters.timeRange === '5m' && diff > 5 * 60 * 1000) {
          return false;
        }

        if (filters.timeRange === '15m' && diff > 15 * 60 * 1000) {
          return false;
        }

        if (filters.timeRange === '1h' && diff > 60 * 60 * 1000) {
          return false;
        }

        if (filters.timeRange === 'today') {
          const logDate = new Date(logTime);
          const today = new Date(now);

          if (logDate.toDateString() !== today.toDateString()) {
            return false;
          }
        }
      }
    }

    if (filters.search && filters.search.trim() !== '') {
      const searchTerm = filters.search.trim().toLowerCase();
      const message = (log.message || '').toString().toLowerCase();
      const agent = (log.agent || '').toString().toLowerCase();
      const category = (log.category || '').toString().toLowerCase();

      if (
        !message.includes(searchTerm) &&
        !agent.includes(searchTerm) &&
        !category.includes(searchTerm)
      ) {
        return false;
      }
    }

    return true;
  });
};

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue =
    typeof value === 'object' ? JSON.stringify(value) : value.toString();

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const collectCsvColumns = (logs) => {
  const columns = new Set();

  logs.forEach((log) => {
    if (log && typeof log === 'object') {
      Object.keys(log).forEach((key) => {
        columns.add(key);
      });
    }
  });

  return Array.from(columns);
};

export const formatLogsForExport = (logs = [], format = 'json') => {
  if (!Array.isArray(logs)) {
    return {
      data: '',
      mimeType: 'text/plain',
      extension: 'txt'
    };
  }

  if (format === 'csv') {
    const columns = collectCsvColumns(logs);

    if (columns.length === 0) {
      return {
        data: '',
        mimeType: 'text/csv',
        extension: 'csv'
      };
    }

    const header = columns.join(',');
    const rows = logs.map((log) =>
      columns
        .map((column) => escapeCsvValue(log?.[column]))
        .join(',')
    );

    return {
      data: [header, ...rows].join('\n'),
      mimeType: 'text/csv',
      extension: 'csv'
    };
  }

  return {
    data: JSON.stringify(logs, null, 2),
    mimeType: 'application/json',
    extension: 'json'
  };
};
