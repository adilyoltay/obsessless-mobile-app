import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { getSuggestionStats } from '@/features/ai/telemetry/aiTelemetry';
import { useTranslation } from '@/hooks/useTranslation';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const [acceptanceData, setAcceptanceData] = useState<number[]>([0, 0, 0]);
  const [usageData, setUsageData] = useState<number[]>([0, 0, 0]);

  useEffect(() => {
    const seven = getSuggestionStats(7);
    const thirty = getSuggestionStats(30);
    const ninety = getSuggestionStats(90);

    setAcceptanceData([
      seven.acceptanceRate * 100,
      thirty.acceptanceRate * 100,
      ninety.acceptanceRate * 100,
    ]);

    setUsageData([seven.usage, thirty.usage, ninety.usage]);
  }, []);

  return (
    <ScreenLayout>
      <View style={styles.container}>
        <LineChart
          data={{
            labels: ['7d', '30d', '90d'],
            datasets: [
              {
                data: acceptanceData,
                color: () => '#3b82f6',
                strokeWidth: 2,
              },
              {
                data: usageData,
                color: () => '#10b981',
                strokeWidth: 2,
              },
            ],
            legend: [t('progress.acceptance'), t('progress.usage')],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(59,130,246,${opacity})`,
            labelColor: (opacity = 1) => `rgba(107,114,128,${opacity})`,
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#1e3a8a',
            },
          }}
          style={styles.chart}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

