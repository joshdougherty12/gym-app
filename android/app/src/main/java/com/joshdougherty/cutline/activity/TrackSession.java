package com.joshdougherty.cutline.activity;

import android.content.Context;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The activity being tracked, shared by the service (writes fixes) and the plugin (reads them).
 * Kept in files under filesDir/activity so nothing is lost if the web view or the whole app
 * process is killed: session.json (header and pause events, rewritten atomically) and
 * points.csv (one fix per line, appended and flushed every few seconds). The files are deleted
 * only when the app has saved the activity (clear()).
 */
public final class TrackSession {
    private static TrackSession instance;

    private static final long FLUSH_EVERY_MS = 5_000;

    private final File dir;
    private final File sessionFile;
    private final File pointsFile;

    public String id;
    public String type = "run";
    public String unit = "mi";
    public String noun = "run";
    public long startedAt;
    public long endedAt = 0;
    public boolean autoPause = true;
    public boolean splitCue = false;
    public double splitM = 1609.344;
    public final List<TrackMath.Event> events = new ArrayList<>();
    public final List<double[]> points = new ArrayList<>();
    public TrackMath.Odometer odometer = new TrackMath.Odometer(10);

    private BufferedWriter writer;
    private long lastFlush = 0;

    private TrackSession(Context c) {
        dir = new File(c.getFilesDir(), "activity");
        sessionFile = new File(dir, "session.json");
        pointsFile = new File(dir, "points.csv");
        load();
    }

    public static synchronized TrackSession get(Context c) {
        if (instance == null) instance = new TrackSession(c.getApplicationContext());
        return instance;
    }

    public synchronized boolean active() {
        return id != null;
    }

    public synchronized boolean ended() {
        return endedAt > 0;
    }

    public synchronized boolean paused() {
        return TrackMath.isPaused(events);
    }

    public synchronized long activeMs(long now) {
        return TrackMath.activeMs(startedAt, events, endedAt > 0 ? endedAt : now);
    }

    public synchronized double distanceM() {
        return odometer.distanceM;
    }

    public synchronized void start(String id, String type, long startedAt, boolean autoPause, boolean splitCue, double splitM, String unit, String noun) {
        closeWriter();
        deleteFiles();
        this.id = id;
        this.type = type;
        this.startedAt = startedAt;
        this.endedAt = 0;
        this.autoPause = autoPause;
        this.splitCue = splitCue;
        this.splitM = splitM;
        this.unit = unit;
        this.noun = noun;
        events.clear();
        points.clear();
        odometer = new TrackMath.Odometer(TrackMath.maxSpeed(type));
        saveHeader();
    }

    /** A new fix; ignored while paused or ended. Returns the notification distance added. */
    public synchronized double addPoint(long t, double lat, double lon, double acc, double alt, double spd) {
        if (id == null || endedAt > 0 || paused()) return 0;
        double[] p = {t, lat, lon, acc, alt, spd};
        points.add(p);
        try {
            if (writer == null) {
                if (!dir.exists()) dir.mkdirs();
                boolean torn = endsTorn();
                writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(pointsFile, true), StandardCharsets.UTF_8));
                // The app was killed mid-line: end that line so the next fix starts clean.
                if (torn) writer.write('\n');
            }
            writer.write(TrackMath.pointLine(p));
            writer.write('\n');
            if (t - lastFlush >= FLUSH_EVERY_MS) {
                writer.flush();
                lastFlush = t;
            }
        } catch (IOException ignored) {
            // Kept in memory; the next flush tries again.
        }
        return odometer.add(t, lat, lon, acc);
    }

    public synchronized void event(String kind, long t) {
        if (id == null || endedAt > 0) return;
        boolean p = paused();
        if ("pause".equals(kind) && p) return;
        if ("resume".equals(kind) && !p) return;
        long last = events.isEmpty() ? t : events.get(events.size() - 1).t;
        events.add(new TrackMath.Event(Math.max(t, last), kind));
        if (!"pause".equals(kind)) odometer.breakSegment();
        flush();
        saveHeader();
    }

    public synchronized void stop(long t) {
        if (id == null || endedAt > 0) return;
        endedAt = t;
        flush();
        saveHeader();
    }

    public synchronized void clear() {
        closeWriter();
        deleteFiles();
        id = null;
        endedAt = 0;
        events.clear();
        points.clear();
        odometer = new TrackMath.Odometer(10);
    }

    public synchronized void flush() {
        try {
            if (writer != null) writer.flush();
        } catch (IOException ignored) {
            // Nothing more to do.
        }
    }

    public synchronized List<double[]> pointsFrom(int from) {
        if (from < 0) from = 0;
        if (from >= points.size()) return new ArrayList<>();
        return new ArrayList<>(points.subList(from, points.size()));
    }

    public synchronized int pointCount() {
        return points.size();
    }

    // ---- Files ----

    private boolean endsTorn() {
        if (!pointsFile.exists() || pointsFile.length() == 0) return false;
        try (java.io.RandomAccessFile f = new java.io.RandomAccessFile(pointsFile, "r")) {
            f.seek(f.length() - 1);
            return f.read() != '\n';
        } catch (IOException e) {
            return false;
        }
    }

    private void closeWriter() {
        try {
            if (writer != null) writer.close();
        } catch (IOException ignored) {
            // Closing anyway.
        }
        writer = null;
    }

    private void deleteFiles() {
        //noinspection ResultOfMethodCallIgnored
        sessionFile.delete();
        //noinspection ResultOfMethodCallIgnored
        pointsFile.delete();
    }

    private void saveHeader() {
        try {
            if (!dir.exists()) dir.mkdirs();
            JSONObject o = new JSONObject();
            o.put("id", id);
            o.put("type", type);
            o.put("unit", unit);
            o.put("noun", noun);
            o.put("startedAt", startedAt);
            o.put("endedAt", endedAt);
            o.put("autoPause", autoPause);
            o.put("splitCue", splitCue);
            o.put("splitM", splitM);
            JSONArray ev = new JSONArray();
            for (TrackMath.Event e : events) ev.put(new JSONObject().put("t", e.t).put("kind", e.kind));
            o.put("events", ev);
            File tmp = new File(dir, "session.json.tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(o.toString().getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            }
            if (!tmp.renameTo(sessionFile)) {
                //noinspection ResultOfMethodCallIgnored
                sessionFile.delete();
                //noinspection ResultOfMethodCallIgnored
                tmp.renameTo(sessionFile);
            }
        } catch (IOException | JSONException ignored) {
            // The in-memory session carries on.
        }
    }

    private void load() {
        if (!sessionFile.exists()) return;
        try {
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(sessionFile), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            JSONObject o = new JSONObject(sb.toString());
            id = o.optString("id", null);
            if (id == null || id.isEmpty()) {
                id = null;
                return;
            }
            type = o.optString("type", "run");
            unit = o.optString("unit", "mi");
            noun = o.optString("noun", type);
            startedAt = o.optLong("startedAt", System.currentTimeMillis());
            endedAt = o.optLong("endedAt", 0);
            autoPause = o.optBoolean("autoPause", true);
            splitCue = o.optBoolean("splitCue", false);
            splitM = o.optDouble("splitM", 1609.344);
            JSONArray ev = o.optJSONArray("events");
            if (ev != null) for (int i = 0; i < ev.length(); i++) {
                JSONObject e = ev.getJSONObject(i);
                events.add(new TrackMath.Event(e.getLong("t"), e.getString("kind")));
            }
            if (pointsFile.exists()) {
                List<String> lines = new ArrayList<>();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(pointsFile), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = r.readLine()) != null) lines.add(line);
                }
                points.addAll(TrackMath.parsePoints(lines));
            }
            odometer = new TrackMath.Odometer(TrackMath.maxSpeed(type));
            odometer.distanceM = TrackMath.replay(points, events, type);
        } catch (IOException | JSONException e) {
            id = null;
        }
    }
}
