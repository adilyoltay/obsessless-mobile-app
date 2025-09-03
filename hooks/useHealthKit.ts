import { useState } from 'react';
import { Platform } from 'react-native';
import { HealthKitMoodSync } from '@/services/healthKitIntegration';

export const useHealthKit = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);

  const requestAuthorization = async () => {
    if (Platform.OS !== 'ios') {
      setIsAuthorized(false);
      return false;
    }
    try {
      // Stub always false until native module wired
      const authorized = false;
      setIsAuthorized(authorized);
      if (authorized) {
        const sync = new HealthKitMoodSync();
        await sync.syncBidirectional();
      }
      return authorized;
    } catch (error) {
      console.error('HealthKit authorization failed:', error);
      setIsAuthorized(false);
      return false;
    }
  };

  return { isAuthorized, requestAuthorization };
};

export default useHealthKit;

