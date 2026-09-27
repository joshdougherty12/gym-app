package com.joshdougherty.cutline.activity;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class TrackMathTest {
    private static final double M_PER_DEG = 111_195.08;
    private static final long T0 = 1_700_000_000_000L;

    /** 1 Hz fixes heading north at `speed` m/s. */
    private static List<double[]> line(int seconds, double speed, long t0, double northStart) {
        List<double[]> out = new ArrayList<>();
        for (int i = 0; i < seconds; i++) out.add(new double[] {t0 + i * 1000L, 40 + (northStart + i * speed) / M_PER_DEG, -75, 5, 100, speed});
        return out;
    }

    @Test
    public void haversineMatchesTheApp() {
        assertEquals(M_PER_DEG, TrackMath.haversineM(0, 0, 1, 0), 1);
        assertEquals(5540, TrackMath.haversineM(40.6413, -73.7781, 51.47, -0.4543) / 1000, 10);
    }

    @Test
    public void odometerCountsSteadyMovement() {
        TrackMath.Odometer o = new TrackMath.Odometer(TrackMath.maxSpeed("run"));
        for (double[] p : line(601, 3, T0, 0)) o.add((long) p[0], p[1], p[2], p[3]);
        assertEquals(1800, o.distanceM, 10);
    }

    @Test
    public void odometerIgnoresJitterBadFixesAndJumps() {
        TrackMath.Odometer o = new TrackMath.Odometer(TrackMath.maxSpeed("run"));
        o.add(T0, 40, -75, 5);
        // Standing still with 2 m wobble adds nothing (5 m minimum step).
        for (int i = 1; i < 60; i++) o.add(T0 + i * 1000L, 40 + ((i % 2) * 2) / M_PER_DEG, -75, 5);
        assertEquals(0, o.distanceM, 0.001);
        // A 60 m-accuracy fix and a 1 km jump in one second are skipped.
        assertEquals(0, o.add(T0 + 61_000, 40 + 50 / M_PER_DEG, -75, 60), 0);
        assertEquals(0, o.add(T0 + 62_000, 40 + 1000 / M_PER_DEG, -75, 5), 0);
        assertTrue(o.add(T0 + 63_000, 40 + 8 / M_PER_DEG, -75, 5) > 7);
    }

    @Test
    public void odometerAcceptsARealRelocationAfterFiveRejections() {
        TrackMath.Odometer o = new TrackMath.Odometer(5);
        o.add(T0, 40, -75, 5);
        for (int i = 1; i <= 5; i++) assertEquals(0, o.add(T0 + i * 1000L, 40.05, -75, 5), 0);
        assertTrue(o.add(T0 + 6000, 40.05, -75, 5) > 5000);
    }

    @Test
    public void activeTimeLeavesOutPauses() {
        List<TrackMath.Event> ev = Arrays.asList(new TrackMath.Event(T0 + 10_000, "pause"), new TrackMath.Event(T0 + 40_000, "resume"), new TrackMath.Event(T0 + 50_000, "gap"));
        assertEquals(70_000, TrackMath.activeMs(T0, ev, T0 + 100_000));
        assertEquals(10_000, TrackMath.activeMs(T0, ev, T0 + 20_000));
        assertFalse(TrackMath.isPaused(ev));
        assertTrue(TrackMath.isPaused(ev.subList(0, 1)));
    }

    @Test
    public void replayDoesNotJoinAcrossAPauseOrGap() {
        List<double[]> pts = new ArrayList<>(line(100, 3, T0, 0));
        // Paused at 100 s, walked 300 m, resumed at 200 s.
        pts.addAll(line(100, 3, T0 + 200_000, 600));
        List<TrackMath.Event> ev = Arrays.asList(new TrackMath.Event(T0 + 100_000, "pause"), new TrackMath.Event(T0 + 200_000, "resume"));
        double d = TrackMath.replay(pts, ev, "run");
        assertEquals(2 * 297, d, 12);
        assertEquals(d + 303, TrackMath.replay(pts, new ArrayList<>(), "run"), 12);
    }

    @Test
    public void countsSplitBoundaries() {
        assertEquals(0, TrackMath.splitsCrossed(100, 1500, 1609.344));
        assertEquals(1, TrackMath.splitsCrossed(1600, 1610, 1609.344));
        assertEquals(3, TrackMath.splitsCrossed(900, 3100, 1000));
        assertEquals(0, TrackMath.splitsCrossed(1610, 1600, 1609.344));
    }

    @Test
    public void formatsLikeTheApp() {
        assertEquals("12:03", TrackMath.duration(723_000));
        assertEquals("1:02:03", TrackMath.duration(3_723_000));
        assertEquals("1.24", TrackMath.distance(1609.344 * 1.249, 1609.344));
        assertEquals("2.50", TrackMath.distance(2500, 1000));
    }

    @Test
    public void pointLinesRoundTripAndTornLinesAreSkipped() {
        double[] p = {T0, 40.123456, -75.5, 4.5, Double.NaN, 3.1};
        String line = TrackMath.pointLine(p);
        assertEquals("1700000000000,40.123456,-75.5,4.5,,3.1", line);
        double[] back = TrackMath.parsePoint(line);
        assertEquals(T0, (long) back[0]);
        assertArrayEquals(new double[] {40.123456, -75.5, 4.5}, Arrays.copyOfRange(back, 1, 4), 1e-9);
        assertTrue(Double.isNaN(back[4]));
        assertNull(TrackMath.parsePoint("1700000000000,40.12"));
        assertNull(TrackMath.parsePoint("1700000000000,95,-75,,,"));
        assertNull(TrackMath.parsePoint("abc,40,-75,,,"));
        assertEquals(2, TrackMath.parsePoints(Arrays.asList(line, "garbage", line, "1700000000000,40.1")).size());
    }
}
