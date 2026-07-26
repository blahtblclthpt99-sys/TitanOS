import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  legToJournalRow,
  summarizeDayTrips,
  buildDailyTripReportCsv,
  formatTimerHms,
} from "../src/lib/driverActivity/tripJournal.js";
import { buildDailyTripReportExcel, buildSpreadsheetMl } from "../src/lib/driverActivity/excelExport.js";

describe("Trip journal + daily report", () => {
  it("formats timers as HH:MM:SS", () => {
    assert.equal(formatTimerHms(3661), "01:01:01");
    assert.equal(formatTimerHms(90), "00:01:30");
  });

  it("keeps drive_sec and idle_sec separate on each leg", () => {
    const row = legToJournalRow(
      { id: "sess1", started_at: "2026-07-25T12:00:00.000Z" },
      {
        id: "stop1",
        started_at: "2026-07-25T12:20:00.000Z",
        ended_at: "2026-07-25T12:25:00.000Z",
        duration_sec: 300,
        drive_since_prev_sec: 600,
        miles_since_prev: 4.2,
        label: "Drop A",
      },
      null,
      0
    );
    assert.equal(row.drive_sec, 600);
    assert.equal(row.idle_sec, 300);
    assert.equal(row.drive_hms, "00:10:00");
    assert.equal(row.idle_hms, "00:05:00");
    assert.equal(row.miles, 4.2);
  });

  it("builds spreadsheet CSV with separate timer columns", () => {
    const csv = buildDailyTripReportCsv(
      [
        {
          id: "t1",
          date: "2026-07-25",
          trip_number: 1,
          started_at: "2026-07-25T12:00:00.000Z",
          ended_at: "2026-07-25T12:15:00.000Z",
          drive_sec: 600,
          idle_sec: 300,
          between_orders_sec: 120,
          pause_sec: 60,
          miles: 3.5,
          label: "Trip 1",
          app: "DoorDash",
        },
      ],
      { date: "2026-07-25" }
    );
    assert.match(csv, /drive_timer_hms/);
    assert.match(csv, /idle_timer_hms/);
    assert.match(csv, /between_orders_timer_hms/);
    assert.match(csv, /pause_timer_hms/);
    assert.match(csv, /active_timer_hms/);
    assert.match(csv, /cycle_timer_hms/);
    assert.match(csv, /TIMER LEGEND/);
    assert.match(csv, /00:10:00/);
    assert.match(csv, /00:05:00/);
    const sum = summarizeDayTrips([
      { drive_sec: 600, idle_sec: 300, between_orders_sec: 120 },
      { drive_sec: 120, idle_sec: 60, between_orders_sec: 0 },
    ]);
    assert.equal(sum.drive_sec, 720);
    assert.equal(sum.idle_sec, 360);
    assert.equal(sum.between_orders_sec, 120);
    assert.equal(sum.active_sec, 1080);
  });

  it("builds Excel workbook with Trips + Totals + Legend sheets", () => {
    const book = buildDailyTripReportExcel(
      [
        {
          id: "t1",
          date: "2026-07-25",
          trip_number: 1,
          started_at: "2026-07-25T12:00:00.000Z",
          ended_at: "2026-07-25T12:15:00.000Z",
          drive_sec: 600,
          idle_sec: 300,
          between_orders_sec: 120,
          pause_sec: 60,
          miles: 3.5,
          earnings: 12,
          tips: 3,
          zip: "75201",
          label: "Trip 1",
          app: "DoorDash",
        },
      ],
      {
        date: "2026-07-25",
        zipBenchmarks: {
          overall: {
            trips: 1,
            earnings: 15,
            miles: 3.5,
            avg_pay: 15,
            avg_per_mile: 4.29,
            avg_per_hour: 45,
            avg_minutes: 20,
          },
          ranked: [
            {
              zip: "75201",
              trips: 1,
              earnings: 15,
              miles: 3.5,
              avg_pay: 15,
              avg_per_mile: 4.29,
              avg_per_hour: 45,
              avg_minutes: 20,
            },
          ],
        },
      }
    );
    assert.match(book.filename, /\.xls$/);
    assert.equal(book.sheets.length, 4);
    assert.equal(book.sheets[0].name, "Trips");
    assert.equal(book.sheets[1].name, "Daily Totals");
    assert.equal(book.sheets[2].name, "Timer Legend");
    assert.equal(book.sheets[3].name, "ZIP Averages");
    assert.match(book.xml, /Excel\.Sheet/);
    assert.match(book.xml, /drive_timer_hms/);
    assert.match(book.xml, /00:10:00/);
    assert.match(book.xml, /75201/);
    const ml = buildSpreadsheetMl([{ name: "A", rows: [["x", 1]] }]);
    assert.match(ml, /ss:Type="Number">1</);
  });
});
