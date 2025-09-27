import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import {
  addMinutes as addMins,
  addHours as addHrs,
  addDays as addDys,
} from 'date-fns';

export const VN_TZ = 'Asia/Ho_Chi_Minh';

// "Now" for business logic in VN zone, returned as a UTC Date (safe to store as timestamptz)
export function vnNow(): Date {
  // Take current instant, view in VN, then convert back to UTC instant for storage
  const now = new Date();
  const vnView = utcToZonedTime(now, VN_TZ);
  return zonedTimeToUtc(vnView, VN_TZ);
}

// Add helpers that do arithmetic in VN zone then return UTC Date for storage/compare
export function addMinutesVN(base: Date, minutes: number): Date {
  const vn = utcToZonedTime(base, VN_TZ);
  const vnPlus = addMins(vn, minutes);
  return zonedTimeToUtc(vnPlus, VN_TZ);
}
export function addHoursVN(base: Date, hours: number): Date {
  const vn = utcToZonedTime(base, VN_TZ);
  const vnPlus = addHrs(vn, hours);
  return zonedTimeToUtc(vnPlus, VN_TZ);
}
export function addDaysVN(base: Date, days: number): Date {
  const vn = utcToZonedTime(base, VN_TZ);
  const vnPlus = addDys(vn, days);
  return zonedTimeToUtc(vnPlus, VN_TZ);
}

// Format a Date for UI or gateways in VN local time
export function formatVN(date: Date, pattern: string): string {
  return formatInTimeZone(date, VN_TZ, pattern);
}

// VNPAY helpers (vnp_CreateDate / vnp_ExpireDate expect yyyymmddHHMMss in GMT+7)
export function vnpFormatYYYYMMDDHHmmss(date: Date): string {
  return formatInTimeZone(date, VN_TZ, 'yyyyMMddHHmmss');
}
export function parseVnpPayDateToUtc(vnpPayDate: string): Date {
  // vnpPayDate: 'yyyyMMddHHmmss' in VN time
  const y = vnpPayDate.slice(0, 4);
  const m = vnpPayDate.slice(4, 6);
  const d = vnpPayDate.slice(6, 8);
  const hh = vnpPayDate.slice(8, 10);
  const mm = vnpPayDate.slice(10, 12);
  const ss = vnpPayDate.slice(12, 14);
  const isoLocal = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  return zonedTimeToUtc(isoLocal, VN_TZ);
}
