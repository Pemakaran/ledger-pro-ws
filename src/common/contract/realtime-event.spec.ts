import { targetRoom } from '@common/contract/realtime-event.type';

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
