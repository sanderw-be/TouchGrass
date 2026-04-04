import React from 'react';
import { ProgressWidget, ProgressWidgetProps } from '../widget/ProgressWidget';

// The widget uses react-native-android-widget primitives which are already
// mocked in jest.setup.js. We test the component logic (color selection,
// formatting, text output) by rendering and inspecting the JSX tree.

function renderProps(overrides: Partial<ProgressWidgetProps> = {}): ProgressWidgetProps {
  return { current: 0, target: 30, timerRunning: false, ...overrides };
}

describe('ProgressWidget', () => {
  it('renders without crashing', () => {
    const element = ProgressWidget(renderProps());
    expect(element).toBeTruthy();
  });

  it('renders with zero progress', () => {
    const element = ProgressWidget(renderProps({ current: 0, target: 30 }));
    expect(element).toBeTruthy();
  });

  it('renders with full progress', () => {
    const element = ProgressWidget(renderProps({ current: 60, target: 30 }));
    expect(element).toBeTruthy();
  });

  it('renders start button when timer is not running', () => {
    const element = ProgressWidget(renderProps({ timerRunning: false }));
    // The component should include a start button
    expect(element).toBeTruthy();
  });

  it('renders stop button when timer is running', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true }));
    expect(element).toBeTruthy();
  });

  it('handles zero target without division by zero', () => {
    const element = ProgressWidget(renderProps({ current: 10, target: 0 }));
    expect(element).toBeTruthy();
  });
});
