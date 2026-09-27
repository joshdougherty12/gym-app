package com.joshdougherty.cutline.steps;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.TreeMap;

/**
 * Turns readings of the hardware step counter (steps since the phone booted) into steps per
 * local calendar day. Pure Java with no Android types, so it is unit tested on the JVM.
 *
 * Rules:
 * - The first reading after step counting is turned on is only a baseline: steps taken before
 *   that are not counted, because there is no way to know when they happened.
 * - Each later reading adds (reading - previous reading).
 * - The counter goes back to 0 when the phone reboots. A new boot is detected by the boot count
 *   (Settings.Global.BOOT_COUNT) when the phone reports one, otherwise by the boot time moving.
 *   After a reboot the whole reading is new steps, taken since the later of the previous reading
 *   and the boot. Steps between the last reading and the shutdown are lost.
 * - Without a boot count, a reading lower than the previous one is also treated as a reboot
 *   (new baseline at 0). With a boot count, a lower reading on the same boot is a stale, batched
 *   event that arrived late, and is ignored.
 * - A delta that spans midnight is split between the days in proportion to the time spent in
 *   each; any rounding remainder goes to the later day.
 * - A delta faster than {@link #MAX_STEPS_PER_SEC} over its interval (plus some slack) is
 *   impossible and is dropped rather than recorded.
 */
public final class StepLedger {
    static final long BOOT_TOLERANCE_MS = 5 * 60 * 1000L;
    static final double MAX_STEPS_PER_SEC = 5.0;
    static final long SLACK_STEPS = 200;
    static final int KEEP_DAYS = 400;

    /** Last counter reading, or -1 when there is no baseline yet. */
    public long lastCounter = -1;
    public long lastSampleMs = 0;
    public long lastBootMs = 0;
    public int lastBootCount = -1;
    /** Local date (YYYY-MM-DD) to steps. */
    public final TreeMap<String, Long> days = new TreeMap<>();

    /** Forget the baseline (turning counting off, then on again, must not count the gap). Days are kept. */
    public void clearBaseline() {
        lastCounter = -1;
        lastSampleMs = 0;
        lastBootMs = 0;
        lastBootCount = -1;
    }

    /**
     * Record one reading. Returns the steps added (0 for a baseline or an ignored reading).
     *
     * @param counter   the sensor value (steps since boot)
     * @param sampleMs  wall-clock time of the reading
     * @param bootMs    wall-clock time the phone booted (now - elapsedRealtime)
     * @param bootCount Settings.Global.BOOT_COUNT, or -1 if unknown
     */
    public long record(long counter, long sampleMs, long bootMs, int bootCount, TimeZone tz) {
        if (counter < 0) return 0;
        if (lastCounter < 0) {
            setLast(counter, sampleMs, bootMs, bootCount);
            return 0;
        }
        boolean countsKnown = bootCount >= 0 && lastBootCount >= 0;
        boolean newBoot = countsKnown ? bootCount != lastBootCount : Math.abs(bootMs - lastBootMs) > BOOT_TOLERANCE_MS;
        long delta;
        long start;
        if (newBoot) {
            delta = counter;
            start = Math.max(lastSampleMs, bootMs);
        } else if (counter < lastCounter) {
            if (countsKnown) return 0; // stale batched event
            delta = counter;
            start = Math.max(lastSampleMs, bootMs);
        } else {
            delta = counter - lastCounter;
            start = lastSampleMs;
        }
        long end = sampleMs;
        long seconds = Math.max(0, (end - start) / 1000);
        if (delta > SLACK_STEPS + (long) (seconds * MAX_STEPS_PER_SEC)) delta = 0;
        if (delta > 0) split(days, delta, start, end, tz);
        setLast(counter, sampleMs, bootMs, bootCount);
        prune(end, tz);
        return delta;
    }

    private void setLast(long counter, long sampleMs, long bootMs, int bootCount) {
        lastCounter = counter;
        lastSampleMs = sampleMs;
        lastBootMs = bootMs;
        lastBootCount = bootCount;
    }

    private void prune(long nowMs, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(nowMs);
        c.add(Calendar.DAY_OF_MONTH, -KEEP_DAYS);
        String cutoff = dateOf(c.getTimeInMillis(), tz);
        Iterator<String> it = days.keySet().iterator();
        while (it.hasNext()) if (it.next().compareTo(cutoff) < 0) it.remove();
    }

    public long stepsOn(String date) {
        Long v = days.get(date);
        return v == null ? 0 : v;
    }

    /** Spread `delta` steps over [start, end] by local day, in proportion to time. */
    static void split(TreeMap<String, Long> days, long delta, long start, long end, TimeZone tz) {
        if (end <= start) {
            add(days, dateOf(end, tz), delta);
            return;
        }
        List<String> dates = new ArrayList<>();
        List<Long> parts = new ArrayList<>();
        long total = end - start;
        long assigned = 0;
        long segStart = start;
        while (segStart < end) {
            long segEnd = Math.min(end, nextMidnight(segStart, tz));
            long part = (long) Math.floor((double) delta * (segEnd - segStart) / total);
            dates.add(dateOf(segStart, tz));
            parts.add(part);
            assigned += part;
            segStart = segEnd;
        }
        int last = parts.size() - 1;
        parts.set(last, parts.get(last) + (delta - assigned));
        for (int i = 0; i < dates.size(); i++) if (parts.get(i) > 0) add(days, dates.get(i), parts.get(i));
    }

    private static void add(TreeMap<String, Long> days, String date, long n) {
        Long cur = days.get(date);
        days.put(date, (cur == null ? 0 : cur) + n);
    }

    static long nextMidnight(long t, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(t);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.DAY_OF_MONTH, 1);
        return c.getTimeInMillis();
    }

    public static String dateOf(long t, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(t);
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    // ---- storage format: "1|counter|sampleMs|bootMs|bootCount|date=steps,date=steps" ----

    public String serialize() {
        StringBuilder sb = new StringBuilder("1|").append(lastCounter).append('|').append(lastSampleMs).append('|').append(lastBootMs).append('|').append(lastBootCount).append('|');
        boolean first = true;
        for (Map.Entry<String, Long> e : days.entrySet()) {
            if (!first) sb.append(',');
            sb.append(e.getKey()).append('=').append(e.getValue());
            first = false;
        }
        return sb.toString();
    }

    /** Parse a stored ledger; anything unreadable gives an empty ledger. */
    public static StepLedger parse(String s) {
        StepLedger l = new StepLedger();
        if (s == null) return l;
        String[] p = s.split("\\|", -1);
        if (p.length != 6 || !"1".equals(p[0])) return l;
        try {
            l.lastCounter = Long.parseLong(p[1]);
            l.lastSampleMs = Long.parseLong(p[2]);
            l.lastBootMs = Long.parseLong(p[3]);
            l.lastBootCount = Integer.parseInt(p[4]);
            if (!p[5].isEmpty()) {
                for (String kv : p[5].split(",")) {
                    int i = kv.indexOf('=');
                    if (i > 0) l.days.put(kv.substring(0, i), Long.parseLong(kv.substring(i + 1)));
                }
            }
        } catch (NumberFormatException e) {
            return new StepLedger();
        }
        return l;
    }
}
