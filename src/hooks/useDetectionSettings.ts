import { useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert, Linking, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';

import {
  getDetectionStatus,
  toggleHealthConnect,
  toggleGPS,
  verifyHealthConnectPermissions,
  checkGPSPermissions,
  requestGPSPermissions,
  toggleAR,
} from '../detection/index';
import { PermissionService } from '../detection/PermissionService';
import { getKnownLocationsAsync, getSuggestedLocationsAsync, KnownLocation } from '../storage';
import { PermissionSheetConfig } from '../components/PermissionExplainerSheet';
import { emitPermissionIssuesChanged } from '../utils/permissionIssuesChangedEmitter';
import { t } from '../i18n';
import type { SettingsStackParamList } from '../navigation/AppNavigator';

export function useDetectionSettings() {
  const navigation = useNavigation<StackNavigationProp<SettingsStackParamList>>();

  const [detectionStatus, setDetectionStatus] = useState({
    healthConnect: false,
    healthConnectPermission: false,
    activityRecognition: false,
    activityRecognitionPermission: false,
    gps: false,
    gpsPermission: false,
  });
  const [knownLocations, setKnownLocations] = useState<KnownLocation[]>([]);
  const [suggestedCount, setSuggestedCount] = useState(0);
  const [togglingHC, setTogglingHC] = useState(false);
  const [togglingGPS, setTogglingGPS] = useState(false);
  const [togglingAR, setTogglingAR] = useState(false);
  const [permissionSheet, setPermissionSheet] = useState<PermissionSheetConfig | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const isFetchingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setDetectionStatus(await getDetectionStatus());
      setKnownLocations(await getKnownLocationsAsync());
      setSuggestedCount((await getSuggestedLocationsAsync()).length);
    } catch (error) {
      console.error('[useDetectionSettings.loadStatus] Error:', error);
    } finally {
      isFetchingRef.current = false;
      setIsInitializing(false);
    }
  }, []);

  const checkAndUpdatePermissions = useCallback(async () => {
    await Promise.all([
      verifyHealthConnectPermissions(),
      checkGPSPermissions(),
      PermissionService.checkActivityRecognitionPermissions(),
    ]);
    setDetectionStatus(await getDetectionStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
      checkAndUpdatePermissions();

      const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          checkAndUpdatePermissions();
        }
      });
      return () => sub.remove();
    }, [loadStatus, checkAndUpdatePermissions])
  );

  const handleOpenAppSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      }
    } catch (error) {
      console.error('Error opening app settings:', error);
      Alert.alert(t('settings_error_title'), t('settings_error_open_settings_failed'));
    }
  };

  const showHCPermissionSheet = useCallback(() => {
    const disableHC = async () => {
      try {
        await toggleHealthConnect(false);
        setDetectionStatus(await getDetectionStatus());
        emitPermissionIssuesChanged();
      } catch (error) {
        console.error('[useDetectionSettings.showHCPermissionSheet.disable] Error:', error);
      }
    };
    setPermissionSheet({
      title: t('settings_hc_permission_title'),
      body: t('settings_hc_permission_body'),
      openLabel: t('intro_hc_button'),
      onOpen: async () => {
        setPermissionSheet(null);
        navigation.navigate('HealthConnectRationale');
      },
      onCancel: disableHC,
      onDisable: disableHC,
    });
  }, [navigation]);

  const showGPSPermissionSheet = useCallback(() => {
    const disableGPS = async () => {
      try {
        await toggleGPS(false);
        setDetectionStatus(await getDetectionStatus());
        emitPermissionIssuesChanged();
      } catch (error) {
        console.error('[useDetectionSettings.showGPSPermissionSheet.disable] Error:', error);
      }
    };
    setPermissionSheet({
      title: t('settings_gps_permission_required_title'),
      body: t('settings_gps_permission_required_body'),
      openLabel: t('intro_location_button'),
      onOpen: async () => {
        const { status: fgStatus, canAskAgain: fgCanAskAgain } =
          await Location.getForegroundPermissionsAsync();
        const { status: bgStatus, canAskAgain: bgCanAskAgain } =
          await Location.getBackgroundPermissionsAsync();

        if (
          (fgStatus !== 'granted' && fgCanAskAgain === false) ||
          (bgStatus !== 'granted' && bgCanAskAgain === false)
        ) {
          await handleOpenAppSettings();
          setPermissionSheet(null);
          return;
        }

        const { granted } = await requestGPSPermissions();
        if (granted) {
          setDetectionStatus(await getDetectionStatus());
          emitPermissionIssuesChanged();
        } else {
          await handleOpenAppSettings();
        }
        setPermissionSheet(null);
      },
      onCancel: disableGPS,
      onDisable: disableGPS,
    });
  }, []);

  const showARPermissionSheet = useCallback(() => {
    const disableAR = async () => {
      try {
        await toggleAR(false);
        setDetectionStatus(await getDetectionStatus());
        emitPermissionIssuesChanged();
      } catch (error) {
        console.error('[useDetectionSettings.showARPermissionSheet.disable] Error:', error);
      }
    };
    setPermissionSheet({
      title: t('intro_ar_title'),
      body: t('intro_ar_why_body'),
      openLabel: t('intro_ar_button'),
      onOpen: async () => {
        const granted = await PermissionService.requestActivityRecognitionPermissions();
        if (granted) {
          setDetectionStatus(await getDetectionStatus());
          emitPermissionIssuesChanged();
        } else {
          await handleOpenAppSettings();
        }
        setPermissionSheet(null);
      },
      onCancel: disableAR,
      onDisable: disableAR,
    });
  }, []);

  const handleToggleHC = async (value: boolean) => {
    if (togglingHC) return;
    setTogglingHC(true);
    try {
      const result = await toggleHealthConnect(value);
      setDetectionStatus(await getDetectionStatus());
      emitPermissionIssuesChanged();

      if (value && result.needsPermissions) {
        showHCPermissionSheet();
      }
    } catch (error) {
      console.error('Error toggling Health Connect:', error);
      Alert.alert(t('settings_hc_open_error_title'), t('settings_hc_open_error_body'));
    } finally {
      setTogglingHC(false);
    }
  };

  const handleToggleGPS = async (value: boolean) => {
    if (togglingGPS) return;
    setTogglingGPS(true);
    try {
      const result = await toggleGPS(value);
      setDetectionStatus(await getDetectionStatus());
      emitPermissionIssuesChanged();

      if (value && result.needsPermissions) {
        showGPSPermissionSheet();
      }
    } catch (error) {
      console.error('Error toggling GPS:', error);
    } finally {
      setTogglingGPS(false);
    }
  };

  const handleToggleAR = async (value: boolean) => {
    if (togglingAR) return;
    setTogglingAR(true);
    try {
      const result = await toggleAR(value);
      setDetectionStatus(await getDetectionStatus());
      emitPermissionIssuesChanged();

      if (value && result.needsPermissions) {
        showARPermissionSheet();
      }
    } catch (error) {
      console.error('Error toggling AR:', error);
    } finally {
      setTogglingAR(false);
    }
  };

  return {
    detectionStatus,
    knownLocations,
    suggestedCount,
    togglingHC,
    togglingGPS,
    togglingAR,
    permissionSheet,
    isInitializing,
    setPermissionSheet,
    handleToggleHC,
    handleToggleGPS,
    handleToggleAR,
    showHCPermissionSheet,
    showGPSPermissionSheet,
    showARPermissionSheet,
    handleOpenAppSettings,
    loadStatus,
    checkAndUpdatePermissions,
  };
}
