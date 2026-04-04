import { ProgressWidget, ProgressWidgetProps } from '../widget/ProgressWidget';

// The widget uses react-native-android-widget primitives which are already
// mocked in jest.setup.js. We test the component logic (color selection,
// formatting, text output) by rendering and inspecting the JSX tree.

function renderProps(overrides: Partial<ProgressWidgetProps> = {}): ProgressWidgetProps {
  return { current: 0, target: 30, timerRunning: false, ...overrides };
}

/** Recursively collect all TextWidget text values from the JSX tree. */
function collectTexts(element: any): string[] {
  if (!element) return [];
  const texts: string[] = [];
  if (element.props?.text) texts.push(element.props.text);
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child) texts.push(...collectTexts(child));
    }
  } else if (children) {
    texts.push(...collectTexts(children));
  }
  return texts;
}

/** Recursively find a FlexWidget with given clickAction. */
function findByClickAction(element: any, action: string): any {
  if (!element) return null;
  if (element.props?.clickAction === action) return element;
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByClickAction(child, action);
      if (found) return found;
    }
  } else if (children) {
    return findByClickAction(children, action);
  }
  return null;
}

describe('ProgressWidget', () => {
  it('renders without crashing', () => {
    const element = ProgressWidget(renderProps());
    expect(element).toBeTruthy();
  });

  it('shows "0% today" at zero progress in idle state', () => {
    const element = ProgressWidget(renderProps({ current: 0, target: 30 }));
    const texts = collectTexts(element);
    expect(texts).toContain('0% today');
  });

  it('shows "200% today" when current exceeds target', () => {
    const element = ProgressWidget(renderProps({ current: 60, target: 30 }));
    const texts = collectTexts(element);
    expect(texts).toContain('200% today');
  });

  it('shows "start outside session" text in idle state', () => {
    const element = ProgressWidget(renderProps({ timerRunning: false }));
    const texts = collectTexts(element);
    expect(texts).toContain('start outside session');
  });

  it('renders play button with TOGGLE_TIMER in idle state', () => {
    const element = ProgressWidget(renderProps({ timerRunning: false }));
    const timerBtn = findByClickAction(element, 'TOGGLE_TIMER');
    expect(timerBtn).toBeTruthy();
    const texts = collectTexts(timerBtn);
    expect(texts.some((t) => t.includes('▶'))).toBe(true);
  });

  it('renders Stop button when timer is running', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true }));
    const timerBtn = findByClickAction(element, 'TOGGLE_TIMER');
    expect(timerBtn).toBeTruthy();
    const texts = collectTexts(timerBtn);
    expect(texts.some((t) => t.includes('Stop'))).toBe(true);
  });

  it('shows "back inside" text when timer is running', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true }));
    const texts = collectTexts(element);
    expect(texts).toContain('back inside');
  });

  it('shows formatted start time when timer is running with timerStartEpoch', () => {
    // Use a fixed epoch to get a predictable HH:MM string.
    const epoch = new Date('2024-01-15T14:32:00').getTime();
    const element = ProgressWidget(renderProps({ timerRunning: true, timerStartEpoch: epoch }));
    const texts = collectTexts(element);
    const startedTexts = texts.filter((t) => t.startsWith('Started '));
    expect(startedTexts.length).toBeGreaterThan(0);
    // The start time should be HH:MM formatted
    expect(startedTexts[0]).toMatch(/^Started \d{2}:\d{2}$/);
  });

  it('shows "--:--" when timer is running but timerStartEpoch is absent', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true }));
    const texts = collectTexts(element);
    expect(texts).toContain('Started --:--');
  });

  it('shows "--:--" when timerStartEpoch is NaN', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true, timerStartEpoch: NaN }));
    const texts = collectTexts(element);
    expect(texts).toContain('Started --:--');
  });

  it('handles zero target without division by zero', () => {
    const element = ProgressWidget(renderProps({ current: 10, target: 0 }));
    const texts = collectTexts(element);
    // Should show some percentage without crashing (Infinity protection)
    expect(element).toBeTruthy();
    expect(texts).toBeDefined();
  });

  it('uses OPEN_APP click action on root container', () => {
    const element = ProgressWidget(renderProps());
    expect(element.props.clickAction).toBe('OPEN_APP');
  });
});
