package com.joshdougherty.cutline.activity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Pure helpers for the tracking service (JUnit-tested): distance, the fix filter, active time,
 * and the points file format. The app recomputes everything precisely (smoothing, auto-pause)
 * from the raw fixes; the notification's running distance here is a close approximation.
 */
public final class TrackMath {
    private TrackMath() {}

    /** Fixes reported worse than this (m) are skipped for the notification distance (the app applies the same limit). */
    public static final double MAX_ACCURACY_M = 30;
    /** The notification distance only advances by steps of at least this, so standing still adds nothing. */
    public static final double MIN_STEP_M = 5;
    private static final double R = 6_371_008.8;

    /** One pause, resume or gap. */
    public static final class Event {
        public final long t;
        public final String kind;

        public Event(long t, String kind) {
            this.t = t;
            this.kind = kind;
        }
    }

    public static double haversineM(double aLat, double aLon, double bLat, double bLon) {
        double dLat = Math.toRadians(bLat - aLat);
        double dLon = Math.toRadians(bLon - aLon);
        double h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(Math.toRadians(aLat)) * Math.cos(Math.toRadians(bLat)) * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    /** Faster than this between two fixes is a GPS jump (m/s); same values as the app. */
    public static double maxSpeed(String type) {
        if ("bike".equals(type)) return 25;
        if ("run".equals(type)) return 10;
        return 5;
    }

    /** Running distance for the notification: accuracy filter, jump filter, 5 m minimum step, no joining across segments. */
    public static final class Odometer {
        private final double maxSpeed;
        public double distanceM = 0;
        private boolean has = false;
        private double lat, lon;
        private long t;
        private int rejected = 0;

        public Odometer(double maxSpeed) {
            this.maxSpeed = maxSpeed;
        }

        /** A pause, resume or gap: the next fix starts a new segment. */
        public void breakSegment() {
            has = false;
            rejected = 0;
        }

        /** Returns the distance added. */
        public double add(long time, double la, double lo, double acc) {
            if (!Double.isNaN(acc) && acc > MAX_ACCURACY_M) return 0;
            if (!has) {
                has = true;
                lat = la;
                lon = lo;
                t = time;
                return 0;
            }
            if (time <= t) return 0;
            double d = haversineM(lat, lon, la, lo);
            if (d / ((time - t) / 1000.0) > maxSpeed && rejected < 5) {
                rejected++;
                return 0;
            }
            rejected = 0;
            if (d < MIN_STEP_M) return 0;
            lat = la;
            lon = lo;
            t = time;
            distanceM += d;
            return d;
        }
    }

    /** Wall-clock time from start to end minus manual pauses. */
    public static long activeMs(long startedAt, List<Event> events, long end) {
        long total = 0;
        long runFrom = startedAt;
        boolean running = true;
        for (Event e : events) {
            if (e.t > end) break;
            if ("pause".equals(e.kind) && running) {
                total += Math.max(0, e.t - runFrom);
                running = false;
            } else if ("resume".equals(e.kind) && !running) {
                runFrom = e.t;
                running = true;
            }
        }
        if (running) total += Math.max(0, end - runFrom);
        return total;
    }

    public static boolean isPaused(List<Event> events) {
        boolean paused = false;
        for (Event e : events) {
            if ("pause".equals(e.kind)) paused = true;
            else if ("resume".equals(e.kind)) paused = false;
        }
        return paused;
    }

    /** Distance from the stored fixes and events (after the app process restarted). */
    public static double replay(List<double[]> points, List<Event> events, String type) {
        Odometer o = new Odometer(maxSpeed(type));
        int ei = 0;
        for (double[] p : points) {
            long t = (long) p[0];
            boolean brk = false;
            while (ei < events.size() && events.get(ei).t <= t) {
                String k = events.get(ei).kind;
                if ("resume".equals(k) || "gap".equals(k) || "pause".equals(k)) brk = true;
                ei++;
            }
            if (brk) o.breakSegment();
            o.add(t, p[1], p[2], p[3]);
        }
        return o.distanceM;
    }

    /** Number of mile/km boundaries crossed going from `before` to `after` meters. */
    public static int splitsCrossed(double before, double after, double splitM) {
        if (splitM <= 0 || after <= before) return 0;
        return (int) (Math.floor(after / splitM) - Math.floor(before / splitM));
    }

    /** "12:03" or "1:02:03". */
    public static String duration(long ms) {
        long s = Math.max(0, ms / 1000);
        long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        return h > 0 ? String.format(Locale.US, "%d:%02d:%02d", h, m, sec) : String.format(Locale.US, "%d:%02d", m, sec);
    }

    /** "1.24" miles or km (floored to hundredths, like the app). */
    public static String distance(double m, double unitM) {
        return String.format(Locale.US, "%.2f", Math.floor(m / unitM * 100) / 100);
    }

    // ---- Points file: one fix per line "t,lat,lon,acc,alt,spd" (empty = not reported) ----

    private static String num(double v) {
        return Double.isNaN(v) ? "" : (v == Math.rint(v) && Math.abs(v) < 1e15 ? Long.toString((long) v) : Double.toString(v));
    }

    public static String pointLine(double[] p) {
        return (long) p[0] + "," + p[1] + "," + p[2] + "," + num(p[3]) + "," + num(p[4]) + "," + num(p[5]);
    }

    /** Parse one line; null for a torn or corrupt line (the app may have been killed mid-write). */
    public static double[] parsePoint(String line) {
        if (line == null) return null;
        String[] f = line.split(",", -1);
        if (f.length != 6) return null;
        try {
            double[] p = new double[6];
            for (int i = 0; i < 6; i++) p[i] = f[i].isEmpty() ? Double.NaN : Double.parseDouble(f[i]);
            if (Double.isNaN(p[0]) || Double.isNaN(p[1]) || Double.isNaN(p[2])) return null;
            if (Math.abs(p[1]) > 90 || Math.abs(p[2]) > 180) return null;
            return p;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static List<double[]> parsePoints(Iterable<String> lines) {
        List<double[]> out = new ArrayList<>();
        for (String l : lines) {
            double[] p = parsePoint(l);
            if (p != null) out.add(p);
        }
        return out;
    }
}
