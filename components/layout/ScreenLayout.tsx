import React from 'react';
import { View, ScrollView, StyleSheet, Platform, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/Colors';
import OfflineBanner from '@/components/ui/OfflineBanner';
import SafeModeBanner from '@/components/ui/SafeModeBanner';

interface ScreenLayoutProps {
  children: React.ReactNode;
  scrollable?: boolean;
  showStatusBar?: boolean;
  statusBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
  backgroundColor?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

function ScreenLayout({ 
  children, 
  scrollable = true, 
  showStatusBar = true,
  statusBarStyle = 'dark',
  backgroundColor = '#F9FAFB',
  edges = ['top', 'bottom', 'left', 'right']
}: ScreenLayoutProps) {
  const containerStyle = [
    styles.container,
    { backgroundColor }
  ];

  // RN kuralı: Düz string/number children bir <Text> içinde olmalı.
  // Her bir string/number düğümü güvenli şekilde <Text> içine saralım.
  const childArray = React.Children.toArray(children);
  const hasVirtualizedList = childArray.some((node: any) => {
    const typeName = node?.type?.displayName || node?.type?.name || '';
    return ['FlatList', 'SectionList', 'VirtualizedList'].includes(typeName);
  });

  const normalizedChildren = childArray.map((node, idx) => {
    if (typeof node === 'string' || typeof node === 'number') {
      return (
        <Text key={`txt_${idx}`}>
          {node}
        </Text>
      );
    }
    return node as React.ReactNode;
  });

  return (
    <SafeAreaView style={containerStyle} edges={edges}>
      <SafeModeBanner />
      <OfflineBanner />
      {showStatusBar && (
        <StatusBar 
          style={statusBarStyle} 
          backgroundColor={backgroundColor}
          translucent={false}
        />
      )}

      {scrollable && !hasVirtualizedList ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {normalizedChildren}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {normalizedChildren}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

// Header component for screens
export function ScreenHeader({
  title,
  subtitle,
  rightComponent,
}: {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[headerStyles.container, { borderBottomColor: colors.icon }]}>
      <View style={headerStyles.titleContainer}>
        <Text style={[headerStyles.title, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[headerStyles.subtitle, { color: colors.tabIconDefault }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightComponent && (
        <View style={headerStyles.rightContainer}>
          {rightComponent}
        </View>
      )}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: 16,
  },
});

export default ScreenLayout;