import { trackAIInteraction, AIEventType, __testing } from '../aiTelemetry';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (cb: any) => cb(),
  },
}));

describe('AI Telemetry flush failures', () => {
  beforeAll(() => {
    (global as any).__DEV__ = true;
  });

  it('keeps events in buffer when flush fails', async () => {
    const manager: any = __testing.telemetryManager;
    jest.spyOn(manager, 'saveEventsToStorage').mockRejectedValue(new Error('storage fail'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await trackAIInteraction(AIEventType.SYSTEM_STARTED, {});
    expect(manager.eventBuffer.length).toBe(1);

    await manager.flushBuffer();

    expect(errorSpy).toHaveBeenCalled();
    expect(manager.eventBuffer.length).toBe(1);

    errorSpy.mockRestore();
  });
});
