import * as Sentry from '@sentry/react-native';

// DSN is public info - safe to hardcode as fallback
const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  'https://483fd8301b211919ad88b6e0607f48fd@o4511219784155136.ingest.de.sentry.io/4511219789135952';

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    attachScreenshot: true,
  });
}

export { Sentry };
