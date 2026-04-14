import * as Sentry from '@sentry/react-native';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (message: string, error?: unknown) => {
    if (isDev) console.error(message, error);
    if (!isDev && error instanceof Error) {
      Sentry.captureException(error, { extra: { context: message } });
    } else if (!isDev && error) {
      Sentry.captureMessage(message, 'error');
    }
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
};
