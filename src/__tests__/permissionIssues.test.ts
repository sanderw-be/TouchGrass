// Mock detection
jest.mock('../detection', () => ({
  getDetectionStatus: jest.fn(() =>
    Promise.resolve({
      gps: false,
      gpsPermission: true,
      healthConnect: false,
      healthConnectPermission: true,
    })
  ),
  checkWeatherLocationPermissions: jest.fn(() => Promise.resolve(true)),
  checkGPSPermissions: jest.fn(() => Promise.resolve(true)),
  recheckHealthConnect: jest.fn(() => Promise.resolve(true)),
}));

// Mock database
const mockGetSetting = jest.fn(async (key: string, def: string) => def);
jest.mock('../storage', () => ({
  getSettingAsync: (key: string, def: string) => mockGetSetting(key, def),
}));

// Mock calendar service
jest.mock('../calendar/calendarService', () => ({
  hasCalendarPermissions: jest.fn(() => Promise.resolve(true)),
}));

// expo-notifications is mocked globally in jest.setup.js

import { countPermissionIssues } from '../utils/permissionIssues';
import * as detection from '../detection';
import * as CalendarService from '../calendar/calendarService';

describe('countPermissionIssues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation(async (key: string, def: string) => def);
    (detection.getDetectionStatus as jest.Mock).mockResolvedValue({
      gps: false,
      gpsPermission: true,
      healthConnect: false,
      healthConnectPermission: true,
    });
    (detection.checkWeatherLocationPermissions as jest.Mock).mockResolvedValue(true);
    (detection.checkGPSPermissions as jest.Mock).mockResolvedValue(true);
    (detection.recheckHealthConnect as jest.Mock).mockResolvedValue(true);
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
    // Default: notifications denied
    const Notifications = require('expo-notifications');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
  });

  it('returns zero issues when everything is fine', async () => {
    const Notifications = require('expo-notifications');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '0'; // reminders off
      return def;
    });

    const result = await countPermissionIssues();
    expect(result).toEqual({ goals: 0, settings: 0 });
  });

  it('counts GPS permission issue as settings issue', async () => {
    (detection.getDetectionStatus as jest.Mock).mockResolvedValue({
      gps: true,
      gpsPermission: false,
      healthConnect: false,
      healthConnectPermission: true,
    });
    (detection.checkGPSPermissions as jest.Mock).mockResolvedValue(false);
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '0';
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.settings).toBe(1);
  });

  it('clears GPS settings badge when permission is re-granted even if SQLite cache is stale', async () => {
    // Simulate the bug scenario: GPS enabled, cached gpsPermission=false (stale),
    // but OS permission has since been granted (e.g. via Weather fix-flow).
    (detection.getDetectionStatus as jest.Mock).mockResolvedValue({
      gps: true,
      gpsPermission: false, // stale cache value
      healthConnect: false,
      healthConnectPermission: false,
    });
    (detection.checkGPSPermissions as jest.Mock).mockResolvedValue(true); // live OS check: granted
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.settings).toBe(0);
  });

  it('clears HC settings badge when permission is re-granted even if SQLite cache is stale', async () => {
    (detection.getDetectionStatus as jest.Mock).mockResolvedValue({
      gps: false,
      gpsPermission: false,
      healthConnect: true,
      healthConnectPermission: false, // stale cache value
    });
    (detection.recheckHealthConnect as jest.Mock).mockResolvedValue(true); // live OS check: granted
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.settings).toBe(0);
  });

  it('counts weather permission issue as goals issue', async () => {
    (detection.checkWeatherLocationPermissions as jest.Mock).mockResolvedValue(false);
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'weather_enabled') return '1';
      if (key === 'smart_reminders_count') return '0';
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.goals).toBeGreaterThanOrEqual(1);
  });

  it('counts notification permission issue as goals issue when smart reminders are on', async () => {
    const Notifications = require('expo-notifications');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '2';
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.goals).toBeGreaterThanOrEqual(1);
  });

  it('does not count notification permission issue when smart reminders are off', async () => {
    const Notifications = require('expo-notifications');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0'; // disable weather to isolate
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.goals).toBe(0);
  });

  it('counts notification permission as granted when status is granted', async () => {
    const Notifications = require('expo-notifications');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '0'; // disable weather to isolate
      return def;
    });

    const result = await countPermissionIssues();
    expect(result.goals).toBe(0);
  });
});
