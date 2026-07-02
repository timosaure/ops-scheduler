import { DateTime } from 'luxon';

/** Sentinel returned by parseDateTimeInput when the value doesn't parse as a valid date-time. */
export const INVALID_DATE_TIME = 'invalid-date-time';

/**
 * Formats a stored UTC ISO timestamp for editing as a UTC ISO 8601 string with millisecond
 * precision and no offset suffix, e.g. "2026-07-02T14:30:00.000".
 */
export function formatDateTimeInput(isoTime: string): string {
  const utc = DateTime.fromISO(isoTime, { zone: 'utc' });
  return utc.isValid ? (utc.toISO({ includeOffset: false }) ?? '') : '';
}

/**
 * Parses a UTC ISO 8601 date-time typed by the user (e.g. "2026-07-02T14:30:00.000") into a UTC
 * ISO timestamp suitable for storage. An offset/zone in the input, if present, is honored.
 * Returns INVALID_DATE_TIME if the value doesn't parse.
 */
export function parseDateTimeInput(value: string): string {
  const dt = DateTime.fromISO(value.trim(), { zone: 'utc' });
  return dt.isValid ? (dt.toUTC().toISO() ?? INVALID_DATE_TIME) : INVALID_DATE_TIME;
}

/** Current UTC time as an ISO 8601 string, truncated to the minute, for pre-filling new-record forms. */
export function nowDateTimeInput(): string {
  return DateTime.utc().set({ second: 0, millisecond: 0 }).toISO({ includeOffset: false }) ?? '';
}
