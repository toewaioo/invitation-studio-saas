import { useEffect, useState } from "react";

const YANGON_TIME_ZONE = "Asia/Yangon";
const MYANMAR_DIGITS = "၀၁၂၃၄၅၆၇၈၉";

type CountdownStatus = "upcoming" | "today" | "past" | "invalid";

export type DayCountdownState = {
  status: CountdownStatus;
  days: number | null;
};

type CivilDate = { year: number; month: number; day: number };

const toMyanmarDigits = (value: number | string) =>
  String(value).replace(/\d/g, (digit) => MYANMAR_DIGITS[Number(digit)]);

const parseDateOnly = (value: string): CivilDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ? { year, month, day }
    : null;
};

const yangonDate = (now: Date): CivilDate => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: YANGON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
};

const civilDayNumber = ({ year, month, day }: CivilDate) =>
  Date.UTC(year, month - 1, day) / 86_400_000;

export const getDayCountdownState = (
  eventDate: string,
  now: Date = new Date(),
): DayCountdownState => {
  const target = parseDateOnly(eventDate);
  if (!target || Number.isNaN(now.getTime())) return { status: "invalid", days: null };
  const difference = civilDayNumber(target) - civilDayNumber(yangonDate(now));
  if (difference < 0) return { status: "past", days: 0 };
  if (difference === 0) return { status: "today", days: 0 };
  return { status: "upcoming", days: difference };
};

export type DayCountdownProps = {
  eventDate: string;
};

/** A date-only countdown. It intentionally never accepts or reads an event time. */
export default function DayCountdown({ eventDate }: DayCountdownProps) {
  const [state, setState] = useState(() => getDayCountdownState(eventDate));

  useEffect(() => {
    const update = () => setState(getDayCountdownState(eventDate));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [eventDate]);

  if (state.status === "invalid") return null;
  const message = state.status === "past"
    ? "မင်္ဂလာနေ့ ကျော်လွန်ပါပြီ"
    : "ယနေ့ မင်္ဂလာနေ့ပါ";

  return (
    <section
      className={`wedding-countdown day-countdown day-countdown--${state.status}`}
      data-countdown-status={state.status}
      aria-label="မင်္ဂလာနေ့ရက် ရေတွက်မှု"
    >
      {state.status === "upcoming" ? <>
        <p>မင်္ဂလာနေ့အထိ</p>
        <div className="countdown-unit"><strong>{toMyanmarDigits(state.days ?? 0)}</strong><small>ရက်သာ လိုတော့သည်</small></div>
      </> : <p>{message}</p>}
    </section>
  );
}
