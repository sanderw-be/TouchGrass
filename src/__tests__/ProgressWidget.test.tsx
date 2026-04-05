import {
  ProgressWidget,
  ProgressWidgetProps,
  buildRingSvg,
  buildPlaySvg,
  buildStopSvg,
  computeRingSize,
  formatMinutes,
  formatStartTime,
  DEFAULT_RING_SIZE,
  MIN_RING_SIZE,
} from '../widget/ProgressWidget';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

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

/** Recursively collect all SvgWidget svg prop values from the JSX tree. */
function collectSvgs(element: any): string[] {
  if (!element) return [];
  const svgs: string[] = [];
  if (element.props?.svg) svgs.push(element.props.svg);
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child) svgs.push(...collectSvgs(child));
    }
  } else if (children) {
    svgs.push(...collectSvgs(children));
  }
  return svgs;
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

  it('shows play SVG icon and start-outside text in idle state', () => {
    const element = ProgressWidget(renderProps({ timerRunning: false }));
    const texts = collectTexts(element);
    const svgs = collectSvgs(element);
    expect(svgs.some((s) => s.includes('152 64'))).toBe(true); // play triangle path
    expect(texts.some((t) => t.includes('widget_start_outside'))).toBe(true);
  });

  it('shows stop SVG icon, "started HH:MM", and back-inside text in running state', () => {
    const startMs = new Date(2025, 3, 4, 14, 30).getTime(); // 14:30
    const element = ProgressWidget(renderProps({ timerRunning: true, timerStartMs: startMs }));
    const texts = collectTexts(element);
    const svgs = collectSvgs(element);
    expect(texts.some((t) => t.includes('widget_started') && t.includes('14:30'))).toBe(true);
    expect(svgs.some((s) => s.includes('rx="24"'))).toBe(true); // stop square path
    expect(texts.some((t) => t.includes('widget_back_inside'))).toBe(true);
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

  it('uses dynamic ring size from widget dimensions', () => {
    const element = ProgressWidget(renderProps({ widgetWidth: 300, widgetHeight: 200 }));
    // Ring should be min(300,200) - 2*6 padding = 188
    const svg = findSvgProp(element);
    expect(svg).toContain('width="188"');
    expect(svg).toContain('height="188"');
  });

  it('falls back to default ring size without widget dimensions', () => {
    const element = ProgressWidget(renderProps());
    const svg = findSvgProp(element);
    expect(svg).toContain(`width="${DEFAULT_RING_SIZE}"`);
  });
});

describe('computeRingSize', () => {
  it('returns default when no dimensions provided', () => {
    expect(computeRingSize()).toBe(DEFAULT_RING_SIZE);
    expect(computeRingSize(undefined, undefined)).toBe(DEFAULT_RING_SIZE);
  });

  it('uses the smaller dimension minus padding', () => {
    expect(computeRingSize(300, 200)).toBe(188); // 200 - 12
    expect(computeRingSize(200, 300)).toBe(188); // 200 - 12
  });

  it('enforces a minimum size', () => {
    expect(computeRingSize(30, 30)).toBe(MIN_RING_SIZE);
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
    const r = (DEFAULT_RING_SIZE - 10) / 2; // STROKE_WIDTH=10
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

  it("does not include rotation (Android widget SVG starts at 12 o'clock)", () => {
    const svg = buildRingSvg(0.5, '#4A7C59');
    expect(svg).not.toContain('rotate');
  });

  it('accepts a custom ring size', () => {
    const svg = buildRingSvg(0.5, '#4A7C59', 200);
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
  });
});

describe('buildPlaySvg', () => {
  it('returns SVG with a play triangle path', () => {
    const svg = buildPlaySvg(28, '#4A7C59');
    expect(svg).toContain('<path');
    expect(svg).toContain('fill="#4A7C59"');
    expect(svg).toContain('viewBox="0 0 512 512"');
  });
});

describe('buildStopSvg', () => {
  it('returns SVG with a stop rounded-rect', () => {
    const svg = buildStopSvg(28, '#F5C842');
    expect(svg).toContain('<rect');
    expect(svg).toContain('rx="24"');
    expect(svg).toContain('fill="#F5C842"');
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
