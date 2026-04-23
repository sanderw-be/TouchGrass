import React from 'react';
import { FlatList, FlatListProps, StyleSheet, useWindowDimensions, View } from 'react-native';

export interface ResponsiveGridListProps<T> extends Omit<FlatListProps<T>, 'numColumns'> {
  data: readonly T[];
}

export function ResponsiveGridList<T>({
  data,
  renderItem,
  ...props
}: ResponsiveGridListProps<T>) {
  const { width } = useWindowDimensions();

  const getNumColumns = (screenWidth: number) => {
    if (screenWidth >= 900) return 3;
    if (screenWidth >= 600) return 2;
    return 1;
  };

  const numColumns = getNumColumns(width);

  return (
    <FlatList
      {...props}
      key={`grid-${numColumns}`}
      data={data}
      renderItem={(info) => (
        <View style={styles.gridItemWrapper}>
          {renderItem?.(info)}
        </View>
      )}
      numColumns={numColumns}
      contentContainerStyle={[styles.listContent, props.contentContainerStyle]}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 8,
  },
  gridItemWrapper: {
    flex: 1,
    padding: 8,
    maxWidth: '100%',
  },
});
