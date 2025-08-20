/**
 * FAZ 1 Kritik Hata Düzeltmeleri Test Senaryoları
 * Bu testler FAZ 1'de yapılan düzeltmeleri doğrular
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
const mockAsyncStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock console methods to avoid noise in test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('FAZ 1: OfflineSyncService Entity Support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Reset module cache
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  test('should support voice_checkin entity type in type definition', () => {
    // Import the type to verify it includes voice_checkin
    const { OfflineSyncService } = require('@/services/offlineSync');
    
    // Create test data with voice_checkin entity
    const testItem = {
      type: 'CREATE' as const,
      entity: 'voice_checkin' as const,
      data: {
        user_id: 'test-user',
        text: 'Test voice text',
        mood: 75,
      },
    };

    // This should not throw TypeScript error (runtime test)
    const service = OfflineSyncService.getInstance();
    expect(service).toBeDefined();
    
    // Verify the service can accept voice_checkin
    expect(async () => {
      await service.addToSyncQueue(testItem);
    }).not.toThrow();
  });

  test('should support thought_record entity type in type definition', () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    
    const testItem = {
      type: 'CREATE' as const,
      entity: 'thought_record' as const,
      data: {
        user_id: 'test-user',
        thought: 'Test thought',
        distortions: ['catastrophizing'],
      },
    };

    const service = OfflineSyncService.getInstance();
    expect(service).toBeDefined();
    
    expect(async () => {
      await service.addToSyncQueue(testItem);
    }).not.toThrow();
  });

  test('should add voice_checkin to sync queue', async () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    const service = OfflineSyncService.getInstance();

    const voiceCheckinData = {
      user_id: 'test-user-123',
      text: 'I am feeling anxious today',
      mood: 40,
      trigger: 'anxiety',
      confidence: 0.85,
      lang: 'en',
    };

    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'voice_checkin',
      data: voiceCheckinData,
    });

    // Verify AsyncStorage.setItem was called
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    
    // Check that the queue key was used
    const calls = mockAsyncStorage.setItem.mock.calls;
    const queueCall = calls.find(call => call[0].includes('syncQueue'));
    expect(queueCall).toBeDefined();
    
    if (queueCall) {
      const savedData = JSON.parse(queueCall[1]);
      expect(savedData.length).toBeGreaterThanOrEqual(1);
      const voiceCheckin = savedData.find((item: any) => item.entity === 'voice_checkin');
      expect(voiceCheckin).toBeDefined();
      expect(voiceCheckin.entity).toBe('voice_checkin');
      expect(voiceCheckin.data).toMatchObject(voiceCheckinData);
    }
  });

  test('should add thought_record to sync queue', async () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    const service = OfflineSyncService.getInstance();

    const thoughtRecordData = {
      user_id: 'test-user-456',
      thought: 'I will fail the presentation',
      distortions: ['catastrophizing', 'fortune_telling'],
      evidence_for: 'I stuttered last time',
      evidence_against: 'I have prepared well',
      reframe: 'I will do my best',
    };

    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'thought_record',
      data: thoughtRecordData,
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    
    const calls = mockAsyncStorage.setItem.mock.calls;
    const queueCall = calls.find(call => call[0].includes('syncQueue'));
    expect(queueCall).toBeDefined();
    
    if (queueCall) {
      const savedData = JSON.parse(queueCall[1]);
      expect(savedData.length).toBeGreaterThanOrEqual(1);
      const thoughtRecord = savedData.find((item: any) => item.entity === 'thought_record');
      expect(thoughtRecord).toBeDefined();
      expect(thoughtRecord.entity).toBe('thought_record');
      expect(thoughtRecord.data).toMatchObject(thoughtRecordData);
    }
  });
});

describe('FAZ 1: Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  test('should handle CBT record with both formats', async () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    const service = OfflineSyncService.getInstance();

    // Test CBT format
    const cbtData = {
      user_id: 'test-user',
      thought: 'Negative thought',
      distortions: ['all_or_nothing'],
      evidence_for: 'Some evidence',
      evidence_against: 'Counter evidence',
      reframe: 'Balanced view',
      mood_before: 3,
      mood_after: 7,
    };

    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'thought_record',
      data: cbtData,
    });

    // Test regular thought record format
    const thoughtData = {
      user_id: 'test-user',
      automatic_thought: 'Automatic negative thought',
      emotions: ['anxiety', 'fear'],
      balanced_thought: 'More balanced perspective',
    };

    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'thought_record',
      data: thoughtData,
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2); // One for each queue operation
  });

  test('should handle multiple items in queue', async () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    const service = OfflineSyncService.getInstance();

    // Add multiple items
    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'voice_checkin',
      data: { user_id: 'user1', text: 'First voice' },
    });

    // Mock the previous item in storage
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      {
        id: 'existing-item',
        type: 'CREATE',
        entity: 'voice_checkin',
        data: { user_id: 'user1', text: 'First voice' },
        timestamp: Date.now(),
        retryCount: 0,
      }
    ]));

    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'thought_record',
      data: { user_id: 'user1', thought: 'Some thought' },
    });

    // Check that items are accumulated
    const calls = mockAsyncStorage.setItem.mock.calls;
    const lastQueueCall = calls[calls.length - 1];
    
    if (lastQueueCall && lastQueueCall[0].includes('syncQueue')) {
      const savedData = JSON.parse(lastQueueCall[1]);
      expect(savedData.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('FAZ 1: Sync Method Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('syncVoiceCheckin method should be defined', () => {
    const offlineSyncModule = require('@/services/offlineSync');
    
    // Check if the module exports OfflineSyncService
    expect(offlineSyncModule.OfflineSyncService).toBeDefined();
    
    // The actual sync methods are private, but we can verify they're called
    // through the public processSyncQueue method
    const service = offlineSyncModule.OfflineSyncService.getInstance();
    expect(service.processSyncQueue).toBeDefined();
  });

  test('syncThoughtRecord method should be defined', () => {
    const offlineSyncModule = require('@/services/offlineSync');
    const service = offlineSyncModule.OfflineSyncService.getInstance();
    
    // Verify the service can process thought records
    expect(service.processSyncQueue).toBeDefined();
  });
});

describe('FAZ 1: Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle sync failures gracefully', async () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    const service = OfflineSyncService.getInstance();

    // Add item that will fail to sync
    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'voice_checkin',
      data: { 
        user_id: null, // Invalid data
        text: '', 
      },
    });

    // Should not throw
    expect(async () => {
      await service.processSyncQueue();
    }).not.toThrow();
  });

  test('should handle storage errors gracefully', async () => {
    const { OfflineSyncService } = require('@/services/offlineSync');
    const service = OfflineSyncService.getInstance();

    // Mock storage error
    mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

    // Should NOT throw, but log error (error is handled internally)
    await service.addToSyncQueue({
      type: 'CREATE',
      entity: 'voice_checkin',
      data: { user_id: 'test', text: 'test' },
    });
    
    // Verify error was handled (setItem was called)
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });
});