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

  it('shows "0 min / 30 min" and "0%" at zero progress', () => {
    const element = ProgressWidget(renderProps({ current: 0, target: 30 }));
    const texts = collectTexts(element);
    expect(texts).toContain('0 min / 30 min');
    expect(texts).toContain('0%');
  });

  it('shows "200%" when current exceeds target', () => {
    const element = ProgressWidget(renderProps({ current: 60, target: 30 }));
    const texts = collectTexts(element);
    expect(texts).toContain('200%');
  });

  it('formats hours correctly for large values', () => {
    const element = ProgressWidget(renderProps({ current: 90, target: 120 }));
    const texts = collectTexts(element);
    expect(texts).toContain('1 h 30 min / 2 h');
  });

  it('renders Start button when timer is not running', () => {
    const element = ProgressWidget(renderProps({ timerRunning: false }));
    const timerBtn = findByClickAction(element, 'TOGGLE_TIMER');
    expect(timerBtn).toBeTruthy();
    const texts = collectTexts(timerBtn);
    expect(texts.some((t) => t.includes('Start'))).toBe(true);
  });

  it('renders Stop button when timer is running', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true }));
    const timerBtn = findByClickAction(element, 'TOGGLE_TIMER');
    expect(timerBtn).toBeTruthy();
    const texts = collectTexts(timerBtn);
    expect(texts.some((t) => t.includes('Stop'))).toBe(true);
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
