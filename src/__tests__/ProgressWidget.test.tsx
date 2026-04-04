import {
  ProgressWidget,
  ProgressWidgetProps,
  buildRingSvg,
  formatMinutes,
  formatStartTime,
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

  it('shows play icon and "start outside" text in idle state', () => {
    const element = ProgressWidget(renderProps({ timerRunning: false }));
    const texts = collectTexts(element);
    expect(texts.some((t) => t.includes('▶'))).toBe(true);
    expect(texts.some((t) => t.includes('start outside'))).toBe(true);
  });

  it('shows "started HH:MM", stop icon, and "back inside" in running state', () => {
    const startMs = new Date(2025, 3, 4, 14, 30).getTime(); // 14:30
    const element = ProgressWidget(renderProps({ timerRunning: true, timerStartMs: startMs }));
    const texts = collectTexts(element);
    expect(texts.some((t) => t.includes('started 14:30'))).toBe(true);
    expect(texts.some((t) => t.includes('⏹'))).toBe(true);
    expect(texts.some((t) => t.includes('back inside'))).toBe(true);
  });

  it('shows "--:--" when timer running but no timerStartMs', () => {
    const element = ProgressWidget(renderProps({ timerRunning: true }));
    const texts = collectTexts(element);
    expect(texts.some((t) => t.includes('--:--'))).toBe(true);
  });

  it('handles zero target without division by zero', () => {
    const element = ProgressWidget(renderProps({ current: 10, target: 0 }));
    expect(element).toBeTruthy();
  });

  it('uses OPEN_APP click action on root container', () => {
    const element = ProgressWidget(renderProps());
    expect(element.props.clickAction).toBe('OPEN_APP');
  });

  it('has TOGGLE_TIMER click action on the centre area', () => {
    const element = ProgressWidget(renderProps());
    const timerBtn = findByClickAction(element, 'TOGGLE_TIMER');
    expect(timerBtn).toBeTruthy();
  });

  it('embeds an SVG circular progress ring', () => {
    const element = ProgressWidget(renderProps({ current: 15, target: 30 }));
    const svg = findSvgProp(element);
    expect(svg).toBeTruthy();
    expect(svg).toContain('<circle');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('rotate(-90');
  });

  it('has transparent (no backgroundColor) root container', () => {
    const element = ProgressWidget(renderProps());
    expect(element.props.style.backgroundColor).toBeUndefined();
  });

  it('SVG ring contains a filled centre circle for background', () => {
    const element = ProgressWidget(renderProps({ current: 15, target: 30 }));
    const svg = findSvgProp(element);
    expect(svg).toContain('fill="#FFFFFF"');
  });
});

describe('buildRingSvg', () => {
  it('returns valid SVG with three circles (fill + track + progress)', () => {
    const svg = buildRingSvg(0.5, '#4A7C59');
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
  });

  it('has full circumference offset at 0%', () => {
    const svg = buildRingSvg(0, '#7EB8D4');
    const r = (130 - 10) / 2; // RING_SIZE=130, STROKE_WIDTH=10
    const circumference = 2 * Math.PI * r;
    expect(svg).toContain(`stroke-dashoffset="${circumference}"`);
  });

  it('has zero offset at 100%', () => {
    const svg = buildRingSvg(1, '#6BAF7A');
    expect(svg).toContain('stroke-dashoffset="0"');
  });

  it('includes a filled inner circle', () => {
    const svg = buildRingSvg(0.5, '#4A7C59');
    expect(svg).toContain('fill="#FFFFFF"');
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

describe('formatStartTime', () => {
  it('formats epoch-ms to HH:MM', () => {
    const epoch = new Date(2025, 0, 15, 9, 5).getTime();
    expect(formatStartTime(epoch)).toBe('09:05');
  });

  it('pads single-digit hours and minutes', () => {
    const epoch = new Date(2025, 0, 1, 3, 7).getTime();
    expect(formatStartTime(epoch)).toBe('03:07');
  });

  it('formats midnight correctly', () => {
    const epoch = new Date(2025, 0, 1, 0, 0).getTime();
    expect(formatStartTime(epoch)).toBe('00:00');
  });
});
