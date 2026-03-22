/**
 * useFormatting
 *
 * Shared formatting helpers used across views and components.
 * Extracted so the same logic is never duplicated in multiple files.
 */

import { format } from 'date-fns';

export function useFormatting() {
  /** Format a number with locale thousands separators, or return "—" for null/undefined. */
  function fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return Number(n).toLocaleString();
  }

  /** Format a percentage to one decimal place, or return "—". */
  function fmtPct(n: number | null | undefined): string {
    if (n == null) return '—';
    return `${parseFloat(String(n)).toFixed(1)}%`;
  }

  /** Format a Unix-ms timestamp as HH:mm:ss, or return "—". */
  function fmtTime(ts: number | null | undefined): string {
    if (!ts) return '—';
    return format(new Date(ts), 'HH:mm:ss');
  }

  /** Format a Date (or timestamp ms) as "Jan 5, 2024", or return "—". */
  function fmtDate(d: Date | number | null | undefined): string {
    if (!d) return '—';
    return format(new Date(d), 'MMM d, yyyy');
  }

  /** Format a Date as "Jan 5, 2024 14:30", or return "—". */
  function fmtDateTime(d: Date | number | null | undefined): string {
    if (!d) return '—';
    return format(new Date(d), 'MMM d, yyyy HH:mm');
  }

  /** Return a CSS color variable string for a percentage severity level. */
  function loadColor(pct: number): string {
    if (pct >= 90) return 'var(--accent-red)';
    if (pct >= 70) return 'var(--accent-amber)';
    return 'var(--accent-cyan)';
  }

  /** Return a CSS color variable string for a CPU temperature. */
  function tempColor(celsius: number): string {
    if (celsius >= 75) return 'var(--accent-red)';
    if (celsius >= 60) return 'var(--accent-amber)';
    return 'var(--accent-green)';
  }

  /** Compute bar width percentage relative to a maximum value. */
  function barWidth(count: number, max: number): number {
    if (!max) return 0;
    return Math.max(4, (count / max) * 100);
  }

  return { fmt, fmtPct, fmtTime, fmtDate, fmtDateTime, loadColor, tempColor, barWidth };
}
