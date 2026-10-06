import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase-config', () => ({ db: {} }));
import { NotificationService, defaultTopics, settingsPayload, topicOptions } from './notification-service';
import type { NotificationRepository } from '@/repositories/notification-repository';

describe('topicOptions', () => {
  it('offers New requests to admins and owners only', () => {
    expect(topicOptions('user').map((o) => o.topic)).toEqual(['news', 'scores', 'schedule']);
    expect(topicOptions(null).map((o) => o.topic)).toEqual(['news', 'scores', 'schedule']);
    expect(topicOptions('admin').map((o) => o.topic)).toEqual(['news', 'scores', 'schedule', 'requests']);
    expect(topicOptions('owner').map((o) => o.topic)).toContain('requests');
  });
});

describe('defaultTopics', () => {
  it('checks the three member topics', () => {
    expect(defaultTopics()).toEqual({ news: true, scores: true, schedule: true });
  });
});

describe('settingsPayload', () => {
  it('writes an explicit boolean for each offered topic', () => {
    expect(settingsPayload('user', new Set(['news']))).toEqual({ news: true, scores: false, schedule: false });
  });

  it('drops requests for a member', () => {
    expect(settingsPayload('user', new Set(['requests', 'scores']))).toEqual({ news: false, scores: true, schedule: false });
    expect(settingsPayload('admin', new Set(['requests']))).toEqual({ news: false, scores: false, schedule: false, requests: true });
  });
});

describe('NotificationService', () => {
  it('loads null when never saved and the topics otherwise', async () => {
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ topics: { news: true } });
    const svc = new NotificationService({ find } as unknown as NotificationRepository);
    await expect(svc.load('u1')).resolves.toEqual({ success: true, data: null });
    await expect(svc.load('u1')).resolves.toEqual({ success: true, data: { news: true } });
  });

  it('saves the payload and reports write errors', async () => {
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const svc = new NotificationService({ save } as unknown as NotificationRepository);
    await expect(svc.save('u1', 'user', new Set(['scores']))).resolves.toEqual({
      success: true, data: { news: false, scores: true, schedule: false },
    });
    expect(save).toHaveBeenCalledWith('u1', { news: false, scores: true, schedule: false });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(svc.save('u1', 'user', new Set())).resolves.toMatchObject({ success: false, code: 'permission-denied' });
  });
});
