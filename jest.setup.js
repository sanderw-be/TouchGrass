// Setup react-native-gesture-handler mocks
import 'react-native-gesture-handler/jestSetup';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const RN = require('react-native');

  const BottomSheetModal = React.forwardRef(({ children, onChange, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      present: () => setVisible(true),
      dismiss: () => {
        setVisible(false);
        onChange?.(-1);
      },
      snapToIndex: () => {},
      snapToPosition: () => {},
      expand: () => {},
      collapse: () => {},
      close: () => {
        setVisible(false);
        onChange?.(-1);
      },
      forceClose: () => {
        setVisible(false);
        onChange?.(-1);
      },
    }));
    if (!visible) return null;
    return React.createElement(RN.View, { testID: 'bottom-sheet-modal', ...props }, children);
  });
  BottomSheetModal.displayName = 'BottomSheetModal';

  const BottomSheetView = ({ children, ...props }) => React.createElement(RN.View, props, children);
  const BottomSheetScrollView = ({ children, ...props }) =>
    React.createElement(RN.ScrollView, props, children);
  const BottomSheetTextInput = React.forwardRef((props, ref) =>
    React.createElement(RN.TextInput, { ...props, ref })
  );
  BottomSheetTextInput.displayName = 'BottomSheetTextInput';
  const BottomSheetBackdrop = (props) => React.createElement(RN.View, props);
  const BottomSheetModalProvider = ({ children }) => children;
  const useBottomSheetModal = () => ({ dismiss: jest.fn(), dismissAll: jest.fn() });

  return {
    __esModule: true,
    default: BottomSheetModal,
    BottomSheetModal,
    BottomSheetView,
    BottomSheetScrollView,
    BottomSheetTextInput,
    BottomSheetBackdrop,
    BottomSheetModalProvider,
    useBottomSheetModal,
  };
});

// Mock react-native-keyboard-controller
jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  return {
    KeyboardProvider: ({ children }) => children,
    KeyboardAvoidingView: ({ children, ...props }) =>
      React.createElement(require('react-native').View, props, children),
    KeyboardAwareScrollView: ({ children, ...props }) =>
      React.createElement(require('react-native').ScrollView, props, children),
    useKeyboardHandler: jest.fn(),
    useReanimatedKeyboardAnimation: jest.fn(() => ({
      height: { value: 0 },
      progress: { value: 0 },
    })),
    KeyboardStickyView: ({ children, ...props }) =>
      React.createElement(require('react-native').View, props, children),
    KeyboardToolbar: ({ children, ...props }) =>
      React.createElement(require('react-native').View, props, children),
  };
});

// Mock react-native-android-widget
jest.mock('react-native-android-widget', () => ({
  registerWidgetTaskHandler: jest.fn(),
  requestWidgetUpdate: jest.fn(() => Promise.resolve()),
  FlexWidget: ({ children }) => children,
  TextWidget: () => null,
  ImageWidget: () => null,
  ListWidget: () => null,
  SvgWidget: () => null,
  IconWidget: () => null,
  OverlapWidget: ({ children }) => children,
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  SafeAreaConsumer: ({ children }) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    runSync: jest.fn(() => ({ lastInsertRowId: 1 })),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 0 })),
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    execAsync: jest.fn(() => Promise.resolve()),
  })),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', regionCode: 'US' }]),
}));

// Mock react-native-localize
jest.mock('react-native-localize', () => ({
  uses24HourClock: jest.fn(() => true),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  registerTaskAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
    DATE: 'date',
    CALENDAR: 'calendar',
    WEEKLY: 'weekly',
  },
  AndroidImportance: {
    MIN: 1,
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
  },
  BackgroundNotificationTaskResult: {
    NewData: 0,
    NoData: 1,
    Failed: 2,
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(() => Promise.resolve(null)),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([])),
  geocodeAsync: jest.fn(() => Promise.resolve([])),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    Balanced: 3,
    High: 4,
    Lowest: 1,
  },
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}));

// Mock react-native-health-connect
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  getGrantedPermissions: jest.fn(),
  readRecords: jest.fn(),
  getSdkStatus: jest.fn(),
  openHealthConnectSettings: jest.fn(),
  SdkAvailabilityStatus: {
    SDK_AVAILABLE: 3,
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  },
}));

// Mock @react-native-community/datetimepicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return jest.fn().mockImplementation(({ value, onChange }) => {
    return React.createElement('DateTimePicker', { value, onChange });
  });
});

// Mock expo-calendar
jest.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCalendarPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCalendarsAsync: jest.fn(() => Promise.resolve([])),
  getEventsAsync: jest.fn(() => Promise.resolve([])),
  createEventAsync: jest.fn(() => Promise.resolve('event-id-1')),
  createCalendarAsync: jest.fn(() => Promise.resolve('touchgrass-cal-id')),
  updateCalendarAsync: jest.fn(() => Promise.resolve('touchgrass-cal-id')),
  EntityTypes: {
    EVENT: 'event',
    REMINDER: 'reminder',
  },
  CalendarAccessLevel: {
    OWNER: 'owner',
  },
  SourceType: {
    LOCAL: 'local',
  },
}));

// Suppress Expo runtime warnings in tests
global.__ExpoImportMetaRegistry = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
};

// Mock structuredClone if not available
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name, testID, size, color, style }) =>
    React.createElement(View, {
      testID: testID || `icon-${name}`,
      style: [{ width: size, height: size }, style],
      accessibilityLabel: name,
    });
  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    Feather: MockIcon,
    FontAwesome: MockIcon,
    FontAwesome5: MockIcon,
    MaterialCommunityIcons: MockIcon,
  };
});

// Mock expo-font
jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

// Mock @expo-google-fonts/nunito
jest.mock('@expo-google-fonts/nunito/400Regular', () => ({
  Nunito_400Regular: 'Nunito_400Regular',
}));
jest.mock('@expo-google-fonts/nunito/600SemiBold', () => ({
  Nunito_600SemiBold: 'Nunito_600SemiBold',
}));
jest.mock('@expo-google-fonts/nunito/700Bold', () => ({ Nunito_700Bold: 'Nunito_700Bold' }));
jest.mock('@expo-google-fonts/nunito/800ExtraBold', () => ({
  Nunito_800ExtraBold: 'Nunito_800ExtraBold',
}));

// Add any additional setup here if needed

// Mock expo-updates
jest.mock('expo-updates', () => ({
  channel: 'preview',
  isEmbeddedLaunch: false,
  updateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  isEnabled: true,
  runtimeVersion: '1.0.0',
  isEmergencyLaunch: false,
  checkForUpdateAsync: jest.fn(() => Promise.resolve({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(() => Promise.resolve({ isNew: true })),
  reloadAsync: jest.fn(() => Promise.resolve()),
  useUpdates: jest.fn(() => ({
    currentlyRunning: {
      updateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      channel: 'preview',
      isEmbeddedLaunch: false,
    },
    isUpdateAvailable: false,
    isUpdatePending: false,
    isChecking: false,
    isDownloading: false,
    checkError: undefined,
    downloadError: undefined,
    availableUpdate: undefined,
  })),
}));

// Mock expo-battery
jest.mock('expo-battery', () => ({
  isBatteryOptimizationEnabledAsync: jest.fn(() => Promise.resolve(false)),
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.2.0',
  nativeBuildVersion: '45',
  applicationName: 'TouchGrass',
  applicationId: 'be.sanderw.touchgrass',
}));

// Mock PermissionService (Activity Recognition uses PermissionsAndroid which is unavailable in Jest)
jest.mock('./src/detection/PermissionService', () => ({
  PermissionService: {
    requestLocationPermissions: jest.fn(() => Promise.resolve(false)),
    requestHealthPermissions: jest.fn(() => Promise.resolve(false)),
    checkWeatherLocationPermissions: jest.fn(() => Promise.resolve(false)),
    requestWeatherLocationPermissions: jest.fn(() => Promise.resolve(false)),
    verifyHealthConnectPermissions: jest.fn(() => Promise.resolve(false)),
    openHealthConnectSettings: jest.fn(() => Promise.resolve(false)),
    checkActivityRecognitionPermissions: jest.fn(() => Promise.resolve(false)),
    requestActivityRecognitionPermissions: jest.fn(() => Promise.resolve(false)),
  },
}));

// Mock ActivityTransitionModule (NativeModules not available in Jest)
jest.mock('./src/modules/ActivityTransitionModule', () => ({
  ActivityTransitionModule: {
    startTracking: jest.fn(() => Promise.resolve()),
    stopTracking: jest.fn(() => Promise.resolve()),
  },
}));
