import { widgetTaskHandler } from '../widget/widget-task-handler';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import * as database from '../storage/database';
import * as manualCheckin from '../detection/manualCheckin';

jest.mock('../storage/database', () => ({
  initDatabase: jest.fn(),
  getTodayMinutesAsync: jest.fn(() => Promise.resolve(20)),
  getCurrentDailyGoalAsync: jest.fn(() => Promise.resolve({ targetMinutes: 60 })),
  getSettingAsync: jest.fn(() => Promise.resolve('')),
  setSettingAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../detection/manualCheckin', () => ({
  logManualSessionAsync: jest.fn(() => Promise.resolve()),
}));

function mockProps(overrides: Partial<WidgetTaskHandlerProps> = {}): WidgetTaskHandlerProps {
  return {
    widgetInfo: {
      widgetName: 'Progress',
      widgetId: 1,
      height: 200,
      width: 300,
      screenInfo: { screenHeightDp: 800, screenWidthDp: 400, density: 2, densityDpi: 320 },
    },
    widgetAction: 'WIDGET_UPDATE',
    renderWidget: jest.fn(),
    ...overrides,
  };
}

describe('widgetTaskHandler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the skeleton then the real widget on WIDGET_ADDED', async () => {
    const props = mockProps({ widgetAction: 'WIDGET_ADDED' });
    await widgetTaskHandler(props);
    // First call: skeleton (before DB); second call: real data (after DB)
    expect(props.renderWidget).toHaveBeenCalledTimes(2);
  });

  it('renders the skeleton then the real widget on WIDGET_UPDATE', async () => {
    const props = mockProps({ widgetAction: 'WIDGET_UPDATE' });
    await widgetTaskHandler(props);
    expect(props.renderWidget).toHaveBeenCalledTimes(2);
  });

  it('renders the skeleton then the real widget on WIDGET_RESIZED', async () => {
    const props = mockProps({ widgetAction: 'WIDGET_RESIZED' });
    await widgetTaskHandler(props);
    expect(props.renderWidget).toHaveBeenCalledTimes(2);
  });

  it('does not render on WIDGET_DELETED', async () => {
    const props = mockProps({ widgetAction: 'WIDGET_DELETED' });
    await widgetTaskHandler(props);
    expect(props.renderWidget).not.toHaveBeenCalled();
  });

  it('calls initDatabase once before processing widget data', async () => {
    const props = mockProps({ widgetAction: 'WIDGET_UPDATE' });
    await widgetTaskHandler(props);
    expect(database.initDatabase).toHaveBeenCalledTimes(1);
  });

  it('renders the skeleton before initDatabase is called', async () => {
    let skeletonRenderedBeforeDb = false;
    let dbCalled = false;

    (database.initDatabase as jest.Mock).mockImplementation(() => {
      dbCalled = true;
    });

    const renderWidget = jest.fn(() => {
      if (!dbCalled) skeletonRenderedBeforeDb = true;
    });

    const props = mockProps({ widgetAction: 'WIDGET_UPDATE', renderWidget });
    await widgetTaskHandler(props);

    expect(skeletonRenderedBeforeDb).toBe(true);
  });

  it('starts timer on TOGGLE_TIMER click when not running', async () => {
    (database.getSettingAsync as jest.Mock).mockResolvedValue('');

    const props = mockProps({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'TOGGLE_TIMER',
    });

    await widgetTaskHandler(props);

    expect(database.setSettingAsync).toHaveBeenCalledWith(
      'widget_timer_start',
      expect.stringMatching(/^\d+$/)
    );
    // Re-renders after state change
    expect(props.renderWidget).toHaveBeenCalledTimes(1);
  });

  it('stops timer on TOGGLE_TIMER click when running', async () => {
    const startTs = String(Date.now() - 120000); // 2 minutes ago
    (database.getSettingAsync as jest.Mock).mockResolvedValue(startTs);

    const props = mockProps({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'TOGGLE_TIMER',
    });

    await widgetTaskHandler(props);

    expect(manualCheckin.logManualSessionAsync).toHaveBeenCalledWith(
      expect.any(Number),
      parseInt(startTs, 10),
      expect.any(Number)
    );
    expect(database.setSettingAsync).toHaveBeenCalledWith('widget_timer_start', '');
    expect(props.renderWidget).toHaveBeenCalledTimes(1);
  });

  it('ignores very short sessions when stopping timer', async () => {
    // Timer started only 1 ms ago — below 0.05 min threshold
    const startTs = String(Date.now() - 1);
    (database.getSettingAsync as jest.Mock).mockResolvedValue(startTs);

    const props = mockProps({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'TOGGLE_TIMER',
    });

    await widgetTaskHandler(props);

    expect(manualCheckin.logManualSessionAsync).not.toHaveBeenCalled();
    expect(database.setSettingAsync).toHaveBeenCalledWith('widget_timer_start', '');
  });

  it('does nothing for unrecognized click actions', async () => {
    const props = mockProps({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'UNKNOWN_ACTION',
    });

    await widgetTaskHandler(props);

    expect(database.setSettingAsync).not.toHaveBeenCalled();
    expect(props.renderWidget).not.toHaveBeenCalled();
  });
});
