import * as Sentry from '@sentry/react-native';
import { logger } from '@/lib/logger';

const APP_START_MS = Date.now();

type StartupMark =
  | 'fonts_loaded'
  | 'session_loaded'
  | 'onboarding_resolved'
  | 'tabs_layout_mounted'
  | 'realtime_deferred_start'
  | 'realtime_started'
  | 'first_usable_screen';

const marks = new Map<StartupMark, number>();

function elapsedSinceStart(): number {
  return Date.now() - APP_START_MS;
}

function elapsedSince(mark: StartupMark): number | null {
  const at = marks.get(mark);
  if (at == null) return null;
  return Date.now() - at;
}

/**
 * Records a startup milestone. In dev, logs to console; in production, adds a Sentry breadcrumb.
 */
export function markStartup(phase: StartupMark, detail?: Record<string, unknown>) {
  if (marks.has(phase)) return;
  marks.set(phase, Date.now());

  const payload = {
    phase,
    msSinceAppStart: elapsedSinceStart(),
    ...detail,
  };

  logger.log(`[startup] ${phase} @ ${payload.msSinceAppStart}ms`, detail ?? '');

  if (!__DEV__) {
    Sentry.addBreadcrumb({
      category: 'startup',
      message: phase,
      level: 'info',
      data: payload,
    });
  }
}

export function markStartupDuration(from: StartupMark, to: StartupMark) {
  const fromMs = marks.get(from);
  const toMs = marks.get(to);
  if (fromMs == null || toMs == null) return;

  const duration = toMs - fromMs;
  logger.log(`[startup] ${from} → ${to}: ${duration}ms`);

  if (!__DEV__) {
    Sentry.addBreadcrumb({
      category: 'startup',
      message: `${from}_to_${to}`,
      level: 'info',
      data: { durationMs: duration },
    });
  }
}

export function getStartupElapsedMs(): number {
  return elapsedSinceStart();
}

export function getStartupMarkMs(phase: StartupMark): number | null {
  return marks.get(phase) ?? null;
}

export function getElapsedSinceMark(phase: StartupMark): number | null {
  return elapsedSince(phase);
}
