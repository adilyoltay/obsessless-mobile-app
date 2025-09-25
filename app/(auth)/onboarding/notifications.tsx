import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import ProgressDots from '@/components/onboarding/ProgressDots';
import * as Notifications from 'expo-notifications';
import { ObsessLessColors, Spacing } from '@/constants/DesignSystem';

type PermissionState = 'granted' | 'denied' | 'undetermined';

const DEFAULT_REMINDER_DAYS: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const mapPermissionStatus = (status: Notifications.PermissionStatus): PermissionState => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
};

export default function NotificationsStep() {
  const router = useRouter();
  const {
    step,
    totalSteps,
    next,
    prev,
    setStep,
    setReminders,
    payload,
    finalizeFlags,
  } = useMoodOnboardingStore();

  const theme = useThemeColors();
  const reminders = payload.reminders;
  const remindersEnabled = reminders?.enabled ?? false;
  const remindersPermissionStatus = reminders?.permissionStatus ?? 'undetermined';
  const remindersTime = reminders?.time ?? '';
  const remindersDays = reminders?.days;
  const remindersTimezone = reminders?.timezone;
  const [enabled, setEnabled] = useState<boolean>(false);
  const [time, setTime] = useState<string>(reminders?.time || '09:00');
  const [days, setDays] = useState<string[]>(reminders?.days || DEFAULT_REMINDER_DAYS);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>(reminders?.permissionStatus || 'undetermined');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  useEffect(() => { setStep(4); }, [setStep]);

  const timezone = useMemo(
    () => remindersTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    [remindersTimezone]
  );

  useEffect(() => {
    const nextTime = reminders?.time;
    if (nextTime) {
      setTime((prev) => (prev === nextTime ? prev : nextTime));
    }
    const nextDays = reminders?.days;
    if (nextDays) {
      setDays((prev) => (areDaysEqual(prev, nextDays) ? prev : nextDays));
    }
  }, [reminders?.days, reminders?.time]);

  const persistReminderState = useCallback(
    (nextEnabled: boolean, nextStatus: PermissionState) => {
      const shouldPersist =
        remindersEnabled !== nextEnabled ||
        remindersPermissionStatus !== nextStatus ||
        remindersTime !== time ||
        !areDaysEqual(remindersDays, days) ||
        (remindersTimezone ?? timezone) !== timezone;

      if (!shouldPersist) return;

      setReminders({ enabled: nextEnabled, time, days, timezone, permissionStatus: nextStatus });
    },
    [days, remindersDays, remindersEnabled, remindersPermissionStatus, remindersTime, remindersTimezone, setReminders, time, timezone]
  );

  const syncPermissions = useCallback(async () => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      const status = mapPermissionStatus(permission.status);
      setPermissionStatus(status);
      const shouldEnable = remindersEnabled && status === 'granted';
      setEnabled(shouldEnable);
      if (status !== 'granted' && remindersEnabled) {
        setPermissionError('Bildirim izni kapatılmış. Hatırlatmaları kullanmak için tekrar izin verin.');
      } else {
        setPermissionError(null);
      }
      persistReminderState(shouldEnable, status);
    } catch (error) {
      console.warn('⚠️ Failed to sync notification permissions:', error);
    }
  }, [persistReminderState, remindersEnabled]);

  useFocusEffect(
    useCallback(() => {
      syncPermissions();
    }, [syncPermissions])
  );

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    try {
      const current = await Notifications.getPermissionsAsync();
      let status = mapPermissionStatus(current.status);
      if (status === 'granted') return status;
      const requested = await Notifications.requestPermissionsAsync();
      status = mapPermissionStatus(requested.status);
      return status;
    } catch (error) {
      console.warn('⚠️ Notification permission request failed:', error);
      return 'undetermined';
    }
  }, []);

  const handleToggle = useCallback(async (value: boolean) => {
    if (isRequestingPermission) return;
    setPermissionError(null);

    if (value) {
      setIsRequestingPermission(true);
      const status = await requestPermission();
      setIsRequestingPermission(false);

      if (status !== 'granted') {
        setPermissionStatus(status);
        setEnabled(false);
        setPermissionError('Bildirim izni verilmedi. Ayarlar’dan izin verdiğinizde hatırlatmalar aktif olur.');
        persistReminderState(false, status);
        return;
      }

      setPermissionStatus('granted');
      setEnabled(true);
      persistReminderState(true, 'granted');
      return;
    }

    setEnabled(false);
    persistReminderState(false, permissionStatus);
  }, [isRequestingPermission, permissionStatus, persistReminderState, requestPermission]);

  const ensurePermissionBeforeContinue = useCallback(async (): Promise<{ enabled: boolean; status: PermissionState }> => {
    if (!enabled) {
      // Persist disabled state with latest status
      persistReminderState(false, permissionStatus);
      return { enabled: false, status: permissionStatus };
    }

    const status = await requestPermission();
    if (status !== 'granted') {
      setPermissionStatus(status);
      setEnabled(false);
      setPermissionError('Bildirim izni olmadan hatırlatmalar gönderemeyiz. Ayarlar’dan izin verebilirsiniz.');
      persistReminderState(false, status);
      return { enabled: false, status };
    }

    persistReminderState(true, 'granted');
    return { enabled: true, status: 'granted' };
  }, [enabled, permissionStatus, persistReminderState, requestPermission]);

  const handleContinue = useCallback(async () => {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      await ensurePermissionBeforeContinue();
      finalizeFlags();
      next();
      router.push('/(auth)/onboarding/summary');
    } finally {
      setIsContinuing(false);
    }
  }, [ensurePermissionBeforeContinue, finalizeFlags, isContinuing, next, router]);

  const handleSkip = useCallback(() => {
    persistReminderState(false, permissionStatus === 'granted' ? 'granted' : 'undetermined');
    finalizeFlags();
    next();
    router.push('/(auth)/onboarding/summary');
  }, [finalizeFlags, next, persistReminderState, permissionStatus, router]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {
      setPermissionError('Ayarlar açılamadı. Lütfen cihaz ayarlarınızdan bildirimi el ile etkinleştirin.');
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }] }>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={styles.title}>
        Günlük hatırlatma (opsiyonel)
      </Text>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextColumn}>
            <Text style={styles.cardTitle}>Hatırlatmalar</Text>
            <Text style={styles.cardSubtitle}>Günlük mood kaydı için nazik bir hatırlatma alın.</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={isRequestingPermission}
            trackColor={{ false: ObsessLessColors.lightGray, true: ObsessLessColors.accent }}
            thumbColor={enabled ? ObsessLessColors.primary : '#F3F4F6'}
          />
        </View>
        <Text style={styles.scheduleText}>Saat: {time} — Günler: Hafta içi</Text>
      </View>

      {permissionError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Bildirim izni gerekli</Text>
          <Text style={styles.errorMessage}>{permissionError}</Text>
          {permissionStatus === 'denied' && (
            <Pressable onPress={openSettings} style={styles.errorAction} accessibilityRole="button">
              <Text style={styles.errorActionText}>Ayarları Aç</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={{ flex: 1 }} />

      <View style={styles.footerButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => { prev(); router.back(); }}
          style={[styles.secondaryButton, styles.buttonSpacing]}
        >
          <Text style={styles.secondaryButtonText}>Geri</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleContinue}
          disabled={isContinuing}
          style={[styles.primaryButton, isContinuing && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{isContinuing ? 'Kaydediliyor…' : 'Devam'}</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={handleSkip}>
        <Text style={styles.skipText}>Atla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: ObsessLessColors.darkerBg,
    marginTop: Spacing.md,
  },
  card: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 16,
    backgroundColor: ObsessLessColors.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchTextColumn: {
    flex: 1,
    marginRight: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ObsessLessColors.primaryText,
  },
  cardSubtitle: {
    marginTop: Spacing.xs,
    color: ObsessLessColors.secondaryText,
  },
  scheduleText: {
    marginTop: Spacing.md,
    color: ObsessLessColors.secondaryText,
    fontSize: 14,
  },
  errorCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: ObsessLessColors.error,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ObsessLessColors.error,
  },
  errorMessage: {
    fontSize: 13,
    color: ObsessLessColors.primaryText,
  },
  errorAction: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: ObsessLessColors.error,
  },
  errorActionText: {
    color: ObsessLessColors.white,
    fontWeight: '600',
  },
  footerButtons: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ObsessLessColors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: ObsessLessColors.primaryText,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ObsessLessColors.primary,
  },
  buttonSpacing: {
    marginRight: Spacing.md,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  primaryButtonText: {
    color: ObsessLessColors.white,
    fontWeight: '700',
  },
  skipText: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    color: ObsessLessColors.secondaryText,
    fontWeight: '500',
  },
});
const areDaysEqual = (next?: string[], base?: string[]) => {
  if (next === base) return true;
  if (!next || !base) return false;
  if (next.length !== base.length) return false;
  return next.every((value, index) => value === base[index]);
};
