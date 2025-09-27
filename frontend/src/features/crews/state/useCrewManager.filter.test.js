import { evaluateCrewFilter } from './useCrewManager';

describe('evaluateCrewFilter', () => {
  const now = Date.now();

  it('returns true when no conditions are provided', () => {
    const metadata = { statusTokens: new Set(['running']), tagTokens: new Set(['alpha']), lastRunTs: now };
    expect(evaluateCrewFilter(metadata, { combinator: 'AND', conditions: [] }, now)).toBe(true);
  });

  it('matches when any selected status is present', () => {
    const metadata = { statusTokens: new Set(['running', 'error']), tagTokens: new Set(), lastRunTs: now };
    const config = {
      combinator: 'AND',
      conditions: [
        { id: '1', field: 'status', operator: 'includesAny', value: ['error', 'ready'] }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
  });

  it('requires all statuses when using includesAll', () => {
    const metadata = { statusTokens: new Set(['running', 'warning']), tagTokens: new Set(), lastRunTs: now };
    const config = {
      combinator: 'AND',
      conditions: [
        { id: '1', field: 'status', operator: 'includesAll', value: ['running', 'warning'] }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
    expect(
      evaluateCrewFilter(metadata, {
        combinator: 'AND',
        conditions: [{ id: '2', field: 'status', operator: 'includesAll', value: ['running', 'error'] }]
      },
      now)
    ).toBe(false);
  });

  it('supports combining status and tag filters', () => {
    const metadata = { statusTokens: new Set(['ready']), tagTokens: new Set(['alpha', 'beta']), lastRunTs: now };
    const config = {
      combinator: 'AND',
      conditions: [
        { id: '1', field: 'status', operator: 'includesAny', value: ['ready'] },
        { id: '2', field: 'tags', operator: 'includesAll', value: ['alpha', 'beta'] }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
  });

  it('supports OR combinator across conditions', () => {
    const metadata = { statusTokens: new Set(['ready']), tagTokens: new Set(['marketing']), lastRunTs: now };
    const config = {
      combinator: 'OR',
      conditions: [
        { id: '1', field: 'status', operator: 'includesAny', value: ['running'] },
        { id: '2', field: 'tags', operator: 'includesAny', value: ['marketing'] }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
  });

  it('matches runs that occurred within the requested window', () => {
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    const metadata = { statusTokens: new Set(['ready']), tagTokens: new Set(), lastRunTs: fourHoursAgo };
    const config = {
      combinator: 'AND',
      conditions: [
        { id: '1', field: 'lastRun', operator: 'within', value: '24h' }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
  });

  it('recognises crews that have never run', () => {
    const metadata = { statusTokens: new Set(['ready']), tagTokens: new Set(), lastRunTs: null };
    const config = {
      combinator: 'AND',
      conditions: [
        { id: '1', field: 'lastRun', operator: 'is', value: 'never' }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
  });

  it('matches crews older than the specified window', () => {
    const fortyFiveDaysAgo = now - 45 * 24 * 60 * 60 * 1000;
    const metadata = { statusTokens: new Set(['ready']), tagTokens: new Set(), lastRunTs: fortyFiveDaysAgo };
    const config = {
      combinator: 'AND',
      conditions: [
        { id: '1', field: 'lastRun', operator: 'olderThan', value: 'older-30d' }
      ]
    };

    expect(evaluateCrewFilter(metadata, config, now)).toBe(true);
  });
});
