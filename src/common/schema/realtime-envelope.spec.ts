import { realtimeEnvelopeSchema, targetRoom } from '@common/schema';

describe('targetRoom', () => {
  it('maps scoped targets to room names', () => {
    expect(targetRoom({ type: 'user', id: '1' })).toBe('user:1');
    expect(targetRoom({ type: 'branch', id: 'b' })).toBe('branch:b');
    expect(targetRoom({ type: 'group', id: 'g' })).toBe('group:g');
  });

  it('maps broadcast to null (whole namespace)', () => {
    expect(targetRoom({ type: 'broadcast' })).toBeNull();
  });
});

describe('realtimeEnvelopeSchema', () => {
  const base = { v: 1, namespace: '/notifications', event: 'e', payload: {} };

  it('accepts every canonical target', () => {
    const targets = [
      { type: 'user', id: 'u' },
      { type: 'branch', id: 'b' },
      { type: 'group', id: 'g' },
      { type: 'broadcast' },
    ];
    for (const target of targets) {
      expect(
        realtimeEnvelopeSchema.safeParse({ ...base, target }).success,
      ).toBe(true);
    }
  });

  it('rejects a bad version, unknown target type, scoped target missing its id, or unknown namespace', () => {
    expect(
      realtimeEnvelopeSchema.safeParse({
        ...base,
        v: 2,
        target: { type: 'broadcast' },
      }).success,
    ).toBe(false);
    expect(
      realtimeEnvelopeSchema.safeParse({
        ...base,
        target: { type: 'room', id: 'x' },
      }).success,
    ).toBe(false);
    // The old hand-rolled guard let this through (no deep target validation).
    expect(
      realtimeEnvelopeSchema.safeParse({ ...base, target: { type: 'user' } })
        .success,
    ).toBe(false);
    expect(
      realtimeEnvelopeSchema.safeParse({
        ...base,
        namespace: '/other',
        target: { type: 'broadcast' },
      }).success,
    ).toBe(false);
  });
});
