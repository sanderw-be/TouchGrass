import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BarChart } from '../screens/HistoryScreen';

describe('HistoryScreen BarChart', () => {
  it('sizes bars to the measured chart width', () => {
    const baseDate = new Date(2024, 0, 1).getTime();
    const data = Array.from({ length: 5 }).map((_, i) => ({
      date: baseDate + i * 86400000,
      minutes: (i + 1) * 10,
    }));

    const { getByTestId, getAllByTestId } = render(
      <BarChart data={data} target={30} maxValue={60} period="week" />,
    );

    fireEvent(getByTestId('history-chart-area'), 'layout', {
      nativeEvent: { layout: { width: 200, height: 160, x: 0, y: 0 } },
    });

    const expectedWidth = 36; // (200 / 5) - 4
    const barWrappers = getAllByTestId('history-bar-wrapper');
    barWrappers.forEach((barWrapper) => {
      expect(barWrapper).toHaveStyle({ width: expectedWidth });
    });
  });
});
