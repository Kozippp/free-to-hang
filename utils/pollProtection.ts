import type { Poll } from '@/store/plansStore';

/**
 * Indices of poll options that cannot be edited (top 2 by vote count).
 * If every option has the same vote count (including all zeros), none are protected.
 * Tie-break for sort: lower index first (stable display order).
 */
export function getProtectedPollOptionIndices(poll: Poll): Set<number> {
  const opts = poll.options;
  if (opts.length < 2) {
    return new Set();
  }

  const counts = opts.map((o) => o.votes.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (min === max) {
    return new Set();
  }

  const indexed = opts.map((o, i) => ({ i, v: o.votes.length }));
  indexed.sort((a, b) => b.v - a.v || a.i - b.i);

  return new Set([indexed[0].i, indexed[1].i]);
}
