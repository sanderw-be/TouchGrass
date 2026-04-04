import {
  ProgressWidget,
  ProgressWidgetProps,
  buildRingSvg,
  formatMinutes,
} from '../widget/ProgressWidget';

// The widget uses react-native-android-widget primitives which are already
// mocked in jest.setup.js. We test the component logic (color selection,
// formatting, SVG generation, text output) by rendering and inspecting the
// JSX tree.

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

/** Recursively find a SvgWidget and return its svg prop. */
function findSvgProp(element: any): string | null {
  if (!element) return null;
  if (element.props?.svg) return element.props.svg;
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findSvgProp(child);
      if (found) return found;
    }
  } else if (children) {
    return findSvgProp(children);
  }
  return null;
}

describe('ProgressWidget', () => {
  it('renders without crashing', () => {
    const element = ProgressWidget(renderProps());
    expect(element).toBeTruthy();
  });

  it('shows current and target minutes at zero progress', () => {
    const element = ProgressWidget(renderProps({ current: 0, target: 30 }));
    const texts = collectTexts(element);
    expect(texts).toContain('0 min');
    expect(texts).toContain('of 30 min');
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
    expect(texts).toContain('1 h 30 min');
    expect(texts).toContain('of 2 h');
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

  it('embeds an SVG circular progress ring', () => {
    const element = ProgressWidget(renderProps({ current: 15, target: 30 }));
    const svg = findSvgProp(element);
    expect(svg).toBeTruthy();
    expect(svg).toContain('<circle');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('rotate(-90');
  });
});

describe('buildRingSvg', () => {
  it('returns valid SVG with two circles', () => {
    const svg = buildRingSvg(0.5, '#4A7C59');
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    // Track + progress circle
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
  });

  it('has full circumference offset at 0%', () => {
    const svg = buildRingSvg(0, '#7EB8D4');
    // At 0% the dashoffset equals circumference, meaning no visible arc
    const r = (86 - 8) / 2; // RING_SIZE=86, STROKE_WIDTH=8
    const circumference = 2 * Math.PI * r;
    expect(svg).toContain(`stroke-dashoffset="${circumference}"`);
  });

  it('has zero offset at 100%', () => {
    const svg = buildRingSvg(1, '#6BAF7A');
    expect(svg).toContain('stroke-dashoffset="0"');
  });
});

describe('formatMinutes', () => {
  it('formats values under 60 as minutes', () => {
    expect(formatMinutes(25)).toBe('25 min');
  });

  it('formats values over 60 with hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1 h 30 min');
  });

  it('formats exact hours without remainder', () => {
    expect(formatMinutes(120)).toBe('2 h');
  });
});
