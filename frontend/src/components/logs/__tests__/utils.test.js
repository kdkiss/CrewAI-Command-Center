import { formatLogsForExport } from '../utils';

describe('formatLogsForExport', () => {
  const sampleLogs = [
    {
      id: 1,
      message: 'Started operation',
      agent: 'alpha',
      category: 'system',
      details: { step: 1 },
      timestamp: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      message: 'Completed operation',
      agent: 'alpha',
      category: 'system',
      status: 'complete',
      timestamp: '2024-01-01T00:05:00Z'
    }
  ];

  it('returns pretty printed JSON by default', () => {
    const result = formatLogsForExport(sampleLogs);

    expect(result).toEqual(
      expect.objectContaining({
        mimeType: 'application/json',
        extension: 'json'
      })
    );
    expect(result.data).toContain('\n  {');
    expect(() => JSON.parse(result.data)).not.toThrow();
  });

  it('flattens logs into CSV rows when requested', () => {
    const result = formatLogsForExport(sampleLogs, 'csv');

    expect(result).toEqual(
      expect.objectContaining({
        mimeType: 'text/csv',
        extension: 'csv'
      })
    );

    const [header, firstRow] = result.data.split('\n');
    expect(header.split(',')).toEqual(
      expect.arrayContaining(['id', 'message', 'agent', 'category', 'details', 'status', 'timestamp'])
    );
    expect(firstRow).toContain('Started operation');
    expect(firstRow).toContain('alpha');
    expect(firstRow).toContain('"{');
  });

  it('returns empty CSV when there are no logs', () => {
    const result = formatLogsForExport([], 'csv');

    expect(result).toEqual({
      data: '',
      mimeType: 'text/csv',
      extension: 'csv'
    });
  });

  it('returns safe defaults when logs are not an array', () => {
    const result = formatLogsForExport(null, 'csv');

    expect(result).toEqual({
      data: '',
      mimeType: 'text/plain',
      extension: 'txt'
    });
  });
});
