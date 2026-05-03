import {
  createNavigationContainerRef,
  ParamListBase,
  CommonActions,
} from '@react-navigation/native';

// Combine stack param lists for global navigation if needed, or use ParamListBase
export const navigationRef = createNavigationContainerRef<ParamListBase>();

/**
 * Navigate to a route from outside a React component.
 * @param name The name of the route.
 * @param params Optional parameters for the route.
 */
export function navigate<RouteName extends keyof ParamListBase>(
  name: RouteName,
  params?: ParamListBase[RouteName]
) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
  }
}
