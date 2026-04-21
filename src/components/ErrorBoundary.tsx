import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { t } from '../i18n';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';

// Google Form URL for crash reports (same for all locales)
const CRASH_REPORT_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSffz8JgoPPf2KxIpn86iYQxkNY33-k3wO3MOLDO7CQvbFNitg/viewform';

// Pre-filled entry IDs from the Google Form
const CATEGORY_ENTRY_ID = 'entry.1795846861';
const REPORT_ENTRY_ID = 'entry.411078901';

function buildFeedbackUrl(error: Error): string {
  const deviceInfo = [
    `Device: ${Constants.deviceName ?? 'unknown'}`,
    `OS: ${Platform.OS} ${Platform.Version}`,
    `App: ${Constants.expoConfig?.version ?? 'unknown'}`,
  ].join('\n');

  const description = error.message ?? 'unknown error';
  const reportContent = `${deviceInfo}\nDescription: ${description}`;

  return (
    `${CRASH_REPORT_FORM_URL}?usp=pp_url` +
    `&${CATEGORY_ENTRY_ID}=${encodeURIComponent('🪲 Bug report')}` +
    `&${REPORT_ENTRY_ID}=${encodeURIComponent(reportContent)}`
  );
}

interface Props {
  children: React.ReactNode;
  colors: ThemeColors;
  shadows: Shadows;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// React Error Boundaries must be class components — hooks cannot be used here.
// See: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
class ErrorBoundaryClass extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('TouchGrass: Unhandled render error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReport = (): void => {
    const { error } = this.state;
    const url = buildFeedbackUrl(error ?? new Error('unknown error'));
    Linking.openURL(url).catch(() => {
      Linking.openURL(CRASH_REPORT_FORM_URL).catch(() => {});
    });
  };

  render() {
    const { colors, shadows } = this.props;
    const styles = makeStyles(colors, shadows);

    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <Image
              source={require('../../assets/herb.png')}
              style={styles.herbImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>{t('error_boundary_title')}</Text>
            <Text style={styles.subtitle}>{t('error_boundary_subtitle')}</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.handleReset}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{t('error_boundary_restart')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={this.handleReport}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>{t('error_boundary_report')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  return (
    <ErrorBoundaryClass colors={colors} shadows={shadows}>
      {children}
    </ErrorBoundaryClass>
  );
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.mist,
      justifyContent: 'center',
    },
    content: {
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 1,
    },
    herbImage: {
      width: 80,
      height: 80,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: 22,
    },
    primaryButton: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.xl,
      width: '100%',
      alignItems: 'center',
      marginBottom: spacing.sm,
      ...shadows.soft,
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: 16,
    },
    secondaryButton: {
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.xl,
      width: '100%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.grass,
    },
    secondaryButtonText: {
      color: colors.grass,
      fontWeight: '600',
      fontSize: 16,
    },
  });
}
