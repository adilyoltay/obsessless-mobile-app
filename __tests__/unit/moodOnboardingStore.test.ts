jest.mock('@/services/moodTrackingService', () => ({
  __esModule: true,
  default: {
    ensureInitialized: jest.fn(),
    scheduleSync: jest.fn(),
  },
}));

jest.mock('@/services/notificationScheduler', () => ({
  __esModule: true,
  NotificationScheduler: {
    scheduleReminder: jest.fn(),
    cancelReminders: jest.fn(),
  },
}));

import { act } from 'react-test-renderer';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';

describe('useMoodOnboardingStore.setReminders', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    const { reset } = useMoodOnboardingStore.getState();
    reset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('persists enabled reminders when permission is granted', () => {
    act(() => {
      useMoodOnboardingStore.getState().setReminders({
        enabled: true,
        permissionStatus: 'granted',
        time: '08:00',
        days: ['Mon', 'Tue'],
        timezone: 'Europe/Istanbul',
      });
    });

    jest.runOnlyPendingTimers();

    const reminders = useMoodOnboardingStore.getState().payload.reminders;
    expect(reminders).toBeDefined();
    expect(reminders?.enabled).toBe(true);
    expect(reminders?.permissionStatus).toBe('granted');
    expect(reminders?.time).toBe('08:00');
    expect(reminders?.days).toEqual(['Mon', 'Tue']);
    expect(reminders?.timezone).toBe('Europe/Istanbul');
  });

  it('forces enabled=false when permission is denied', () => {
    act(() => {
      useMoodOnboardingStore.getState().setReminders({
        enabled: true,
        permissionStatus: 'granted',
        time: '09:00',
        days: ['Mon'],
        timezone: 'UTC',
      });
    });

    jest.runOnlyPendingTimers();

    act(() => {
      useMoodOnboardingStore.getState().setReminders({
        enabled: true,
        permissionStatus: 'denied',
      });
    });

    jest.runOnlyPendingTimers();

    const reminders = useMoodOnboardingStore.getState().payload.reminders;
    expect(reminders).toBeDefined();
    expect(reminders?.enabled).toBe(false);
    expect(reminders?.permissionStatus).toBe('denied');
    expect(reminders?.time).toBe('09:00');
    expect(reminders?.days).toEqual(['Mon']);
  });
});
