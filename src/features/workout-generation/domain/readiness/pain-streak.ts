import type { BodyZone } from '../exercise/exercise.schema';
import type { DailyCheckIn } from './daily-checkin.schema';
import { PAIN_STREAK_PROMOTION_DAYS } from './readiness-policy.constants';

function reportsPainAtOrAbove(checkIn: DailyCheckIn, zone: BodyZone): boolean {
  return checkIn.painReports.some((report) => report.zone === zone && report.level !== 'none');
}

// checkInsMostRecentFirst: the user's check-in history, newest entry first.
export function hasPainStreak(
  checkInsMostRecentFirst: readonly DailyCheckIn[],
  zone: BodyZone,
): boolean {
  if (checkInsMostRecentFirst.length < PAIN_STREAK_PROMOTION_DAYS) return false;

  return checkInsMostRecentFirst
    .slice(0, PAIN_STREAK_PROMOTION_DAYS)
    .every((checkIn) => reportsPainAtOrAbove(checkIn, zone));
}
