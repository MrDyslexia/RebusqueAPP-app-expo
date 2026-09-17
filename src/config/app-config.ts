const isDevelopmentBuild = typeof __DEV__ !== 'undefined' && __DEV__;
const isFixtureModeEnabled =
  isDevelopmentBuild && process.env.EXPO_PUBLIC_USE_FIXTURES === 'true';

export const appConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  fixturesEnabled: isFixtureModeEnabled,
} as const;
