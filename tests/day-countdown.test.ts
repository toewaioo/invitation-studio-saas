import { describe, expect, test } from "bun:test";
import { getDayCountdownState } from "../src/components/DayCountdown";

describe("date-only day countdown", () => {
  test("counts calendar days in Asia/Yangon, not elapsed hours", () => {
    // 00:30 in Yangon on 2027-02-14 (18:00 UTC on the prior day).
    const yangonJustAfterMidnight = new Date("2027-02-13T18:00:00.000Z");
    expect(getDayCountdownState("2027-02-15", yangonJustAfterMidnight)).toEqual({
      status: "upcoming",
      days: 1,
    });
  });

  test("returns today at any time during the Yangon event date", () => {
    const lateYangonDay = new Date("2027-02-14T17:29:59.000Z");
    expect(getDayCountdownState("2027-02-14", lateYangonDay)).toEqual({
      status: "today",
      days: 0,
    });
  });

  test("handles past and invalid dates without a time component", () => {
    const now = new Date("2027-02-14T06:00:00.000Z");
    expect(getDayCountdownState("2027-02-13", now)).toEqual({
      status: "past",
      days: 0,
    });
    expect(getDayCountdownState("2027-02-31", now)).toEqual({
      status: "invalid",
      days: null,
    });
    expect(getDayCountdownState("2027-02-14T12:00:00", now)).toEqual({
      status: "invalid",
      days: null,
    });
  });
});

test('Yangon midnight decrements exactly one calendar day', () => {
  expect(getDayCountdownState('2027-02-15', new Date('2027-02-13T17:29:59Z')).days).toBe(2);
  expect(getDayCountdownState('2027-02-15', new Date('2027-02-13T17:30:00Z')).days).toBe(1);
});
