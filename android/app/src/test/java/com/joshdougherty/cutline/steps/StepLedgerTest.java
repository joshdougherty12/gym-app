package com.joshdougherty.cutline.steps;

import static org.junit.Assert.assertEquals;

import java.util.Calendar;
import java.util.TimeZone;
import org.junit.Test;

public class StepLedgerTest {
    private static final TimeZone TZ = TimeZone.getTimeZone("America/Chicago");

    private static long at(int month, int day, int hour, int minute) {
        Calendar c = Calendar.getInstance(TZ);
        c.clear();
        c.set(2026, month - 1, day, hour, minute, 0);
        return c.getTimeInMillis();
    }

    private static final long BOOT = at(9, 20, 8, 0);

    @Test
    public void firstReadingIsOnlyABaseline() {
        StepLedger l = new StepLedger();
        assertEquals(0, l.record(5000, at(9, 27, 9, 0), BOOT, 7, TZ));
        assertEquals(0, l.stepsOn("2026-09-27"));
        assertEquals(1200, l.record(6200, at(9, 27, 10, 0), BOOT, 7, TZ));
        assertEquals(1200, l.stepsOn("2026-09-27"));
    }

    @Test
    public void rebootDetectedByBootCountCountsStepsSinceBoot() {
        StepLedger l = new StepLedger();
        l.record(9000, at(9, 27, 9, 0), BOOT, 7, TZ);
        long boot2 = at(9, 27, 12, 0);
        // After the reboot the counter restarted: 300 steps since the new boot.
        assertEquals(300, l.record(300, at(9, 27, 12, 30), boot2, 8, TZ));
        assertEquals(300, l.stepsOn("2026-09-27"));
        assertEquals(50, l.record(350, at(9, 27, 12, 40), boot2, 8, TZ));
    }

    @Test
    public void lowerReadingWithoutBootCountIsANewBaseline() {
        StepLedger l = new StepLedger();
        l.record(9000, at(9, 27, 9, 0), BOOT, -1, TZ);
        // Same apparent boot time, lower value: treated as a reset to 0.
        assertEquals(120, l.record(120, at(9, 27, 11, 0), BOOT, -1, TZ));
    }

    @Test
    public void rebootDetectedByBootTimeWhenNoBootCount() {
        StepLedger l = new StepLedger();
        l.record(9000, at(9, 27, 9, 0), BOOT, -1, TZ);
        assertEquals(9100, l.record(9100, at(9, 27, 15, 0), at(9, 27, 10, 0), -1, TZ));
    }

    @Test
    public void staleBatchedEventOnTheSameBootIsIgnored() {
        StepLedger l = new StepLedger();
        l.record(1000, at(9, 27, 9, 0), BOOT, 7, TZ);
        l.record(1500, at(9, 27, 9, 30), BOOT, 7, TZ);
        assertEquals(0, l.record(1400, at(9, 27, 9, 20), BOOT, 7, TZ));
        assertEquals(1500, l.lastCounter);
        assertEquals(500, l.stepsOn("2026-09-27"));
    }

    @Test
    public void deltaAcrossMidnightIsSplitByTime() {
        StepLedger l = new StepLedger();
        l.record(1000, at(9, 26, 23, 0), BOOT, 7, TZ);
        // 3 hours, 1 before midnight and 2 after: 1/3 and 2/3.
        assertEquals(3000, l.record(4000, at(9, 27, 2, 0), BOOT, 7, TZ));
        assertEquals(1000, l.stepsOn("2026-09-26"));
        assertEquals(2000, l.stepsOn("2026-09-27"));
    }

    @Test
    public void roundingRemainderGoesToTheLaterDay() {
        StepLedger l = new StepLedger();
        l.record(0, at(9, 26, 23, 0), BOOT, 7, TZ);
        l.record(1001, at(9, 27, 2, 0), BOOT, 7, TZ);
        assertEquals(333, l.stepsOn("2026-09-26"));
        assertEquals(668, l.stepsOn("2026-09-27"));
    }

    @Test
    public void splitsOverSeveralDaysAndDst() {
        TimeZone tz = TimeZone.getTimeZone("America/Chicago");
        StepLedger l = new StepLedger();
        // Across the November DST change (a 25-hour day).
        Calendar c = Calendar.getInstance(tz);
        c.clear();
        c.set(2026, 10, 1, 0, 0, 0);
        long start = c.getTimeInMillis();
        c.set(2026, 10, 2, 0, 0, 0);
        long end = c.getTimeInMillis();
        l.record(0, start, start - 1000, 1, tz);
        l.record(2500, end, start - 1000, 1, tz);
        assertEquals(2500, l.stepsOn("2026-11-01"));
        assertEquals(0, l.stepsOn("2026-11-02"));
    }

    @Test
    public void impossibleJumpIsDropped() {
        StepLedger l = new StepLedger();
        l.record(0, at(9, 27, 9, 0), BOOT, 7, TZ);
        assertEquals(0, l.record(100_000, at(9, 27, 9, 1), BOOT, 7, TZ));
        assertEquals(100_000, l.lastCounter);
        assertEquals(10, l.record(100_010, at(9, 27, 9, 2), BOOT, 7, TZ));
    }

    @Test
    public void clearBaselineSkipsTheGap() {
        StepLedger l = new StepLedger();
        l.record(0, at(9, 27, 9, 0), BOOT, 7, TZ);
        l.record(500, at(9, 27, 10, 0), BOOT, 7, TZ);
        l.clearBaseline();
        assertEquals(0, l.record(3000, at(9, 27, 14, 0), BOOT, 7, TZ));
        assertEquals(500, l.stepsOn("2026-09-27"));
    }

    @Test
    public void serializeRoundTrip() {
        StepLedger l = new StepLedger();
        l.record(0, at(9, 26, 23, 0), BOOT, 7, TZ);
        l.record(3000, at(9, 27, 2, 0), BOOT, 7, TZ);
        StepLedger r = StepLedger.parse(l.serialize());
        assertEquals(l.serialize(), r.serialize());
        assertEquals(2000, r.stepsOn("2026-09-27"));
        assertEquals(-1, StepLedger.parse("garbage").lastCounter);
        assertEquals(-1, StepLedger.parse(null).lastCounter);
    }
}
