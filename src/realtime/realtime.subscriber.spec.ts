import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { Namespace } from 'socket.io';
import { RealtimeSubscriber } from '@realtime/realtime.subscriber';
import type { RealtimeGateway } from '@realtime/realtime.gateway';

type Dispatchable = { dispatch(raw: string): void };

describe('RealtimeSubscriber.dispatch', () => {
  function setup() {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const ns = { to, emit } as unknown as Namespace;
    const gateway = {
      namespaceFor: jest.fn(() => ns),
    } as unknown as RealtimeGateway;
    const redis = { duplicate: jest.fn() } as unknown as Redis;
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as unknown as ConfigService;

    const subscriber = new RealtimeSubscriber(redis, gateway, config);
    return {
      dispatch: (subscriber as unknown as Dispatchable).dispatch.bind(
        subscriber,
      ),
      to,
      emit,
    };
  }

  it('routes a user-targeted envelope to its room', () => {
    const { dispatch, to, emit } = setup();
    dispatch(
      JSON.stringify({
        v: 1,
        target: { type: 'user', id: 'u1' },
        namespace: '/notifications',
        event: 'notification',
        payload: { title: 'Hi' },
      }),
    );
    expect(to).toHaveBeenCalledWith('user:u1');
    expect(emit).toHaveBeenCalledWith('notification', { title: 'Hi' });
  });

  it('routes a group-targeted envelope to its room', () => {
    const { dispatch, to, emit } = setup();
    dispatch(
      JSON.stringify({
        v: 1,
        target: { type: 'group', id: 'g9' },
        namespace: '/notifications',
        event: 'group-cart:changed',
        payload: { groupId: 'g9' },
      }),
    );
    expect(to).toHaveBeenCalledWith('group:g9');
    expect(emit).toHaveBeenCalledWith('group-cart:changed', { groupId: 'g9' });
  });

  it('broadcasts to the whole namespace when target is broadcast', () => {
    const { dispatch, to, emit } = setup();
    dispatch(
      JSON.stringify({
        v: 1,
        target: { type: 'broadcast' },
        namespace: '/notifications',
        event: 'customer-order:created',
        payload: { id: 'o1' },
      }),
    );
    expect(to).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('customer-order:created', { id: 'o1' });
  });

  it('drops malformed or mis-shaped payloads', () => {
    const { dispatch, to, emit } = setup();
    dispatch('}{ not json');
    dispatch(JSON.stringify({ v: 2, foo: 'bar' }));
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
