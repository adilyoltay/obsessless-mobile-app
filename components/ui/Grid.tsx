
import React, { memo, useCallback, useMemo } from 'react';
import { View, Dimensions, StyleSheet, FlatList } from 'react-native';

interface GridProps<T> {
  data: T[];
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement;
  numColumns?: number;
  spacing?: number;
  keyExtractor?: (item: T, index: number) => string;
  style?: any;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const Grid = memo(function Grid<T>({
  data,
  renderItem,
  numColumns = 2,
  spacing = 16,
  keyExtractor,
  style,
  onEndReached,
  onEndReachedThreshold = 0.5,
  refreshing,
  onRefresh,
}: GridProps<T>) {
  const itemWidth = useMemo(() => 
    (screenWidth - spacing * (numColumns + 1)) / numColumns,
    [numColumns, spacing]
  );

  const renderGridItem = useCallback(({ item, index }: { item: T; index: number }) => {
    return (
      <View style={[
        styles.gridItem,
        {
          width: itemWidth,
          marginLeft: spacing,
          marginBottom: spacing,
        }
      ]}>
        {renderItem({ item, index })}
      </View>
    );
  }, [renderItem, itemWidth, spacing]);

  const contentContainerStyle = useMemo(() => [
    styles.container,
    style
  ], [style]);

  return (
    <FlatList
      data={data}
      renderItem={renderGridItem}
      numColumns={numColumns}
      keyExtractor={keyExtractor}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshing={refreshing}
      onRefresh={onRefresh}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={8}
      getItemLayout={numColumns === 1 ? (data, index) => ({
        length: itemWidth + spacing,
        offset: (itemWidth + spacing) * index,
        index,
      }) : undefined}
    />
  );
}) as <T>(props: GridProps<T>) => React.ReactElement;

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  gridItem: {
    // Grid item styles will be applied dynamically
  },
});
