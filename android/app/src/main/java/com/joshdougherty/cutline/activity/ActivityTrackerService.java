package com.joshdougherty.cutline.activity;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import com.joshdougherty.cutline.MainActivity;
import com.joshdougherty.cutline.R;

/**
 * Records GPS fixes for the activity in progress with the screen off or the app in the
 * background. Started only from a visible user action (Start in the app, or the app reopening
 * an interrupted session), so "while in use" location permission is enough: a foreground
 * service of type "location" keeps that access while it runs. Uses the platform GPS provider
 * directly (no Google Play services). The notification shows the distance and time, with
 * Pause/Resume and Open.
 */
public class ActivityTrackerService extends Service implements LocationListener {
    static final String ACTION_START = "com.joshdougherty.cutline.activity.START";
    static final String ACTION_PAUSE = "com.joshdougherty.cutline.activity.PAUSE";
    static final String ACTION_RESUME = "com.joshdougherty.cutline.activity.RESUME";
    static final String ACTION_REFRESH = "com.joshdougherty.cutline.activity.REFRESH";
    static final String ACTION_RESTART = "com.joshdougherty.cutline.activity.RESTART";

    private static final String CHANNEL = "activity-tracking";
    private static final int NOTIFICATION_ID = 4401;
    private static final long NOTIFY_EVERY_MS = 5_000;
    private static final long GPS_INTERVAL_MS = 1_000;

    /** True while listening to GPS (read by the plugin). */
    static volatile boolean running = false;

    private HandlerThread thread;
    private Handler handler;
    private LocationManager locations;
    private boolean listening = false;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            updateNotification();
            handler.postDelayed(this, NOTIFY_EVERY_MS);
        }
    };

    static void send(Context c, String action) {
        Intent i = new Intent(c, ActivityTrackerService.class).setAction(action);
        if (ACTION_START.equals(action) || ACTION_RESTART.equals(action)) ContextCompat.startForegroundService(c, i);
        else c.startService(i);
    }

    static void stop(Context c) {
        c.stopService(new Intent(c, ActivityTrackerService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        thread = new HandlerThread("rightpace-gps");
        thread.start();
        handler = new Handler(thread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        TrackSession s = TrackSession.get(this);
        String action = intent == null || intent.getAction() == null ? ACTION_RESTART : intent.getAction();
        try {
            int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(s), type);
        } catch (RuntimeException e) {
            // Not allowed right now (e.g. restarted from the background): the app restarts
            // tracking the next time it is opened.
            shutdown();
            return START_NOT_STICKY;
        }
        if (!s.active() || s.ended()) {
            shutdown();
            return START_NOT_STICKY;
        }
        long now = System.currentTimeMillis();
        if (ACTION_PAUSE.equals(action)) s.event("pause", now);
        else if (ACTION_RESUME.equals(action)) s.event("resume", now);
        else if (ACTION_RESTART.equals(action) && !listening && !s.paused() && s.pointCount() > 0) s.event("gap", now);
        if (!listening && !listen()) {
            shutdown();
            return START_NOT_STICKY;
        }
        updateNotification();
        return START_STICKY;
    }

    private boolean listen() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return false;
        locations = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locations == null) return false;
        try {
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, GPS_INTERVAL_MS, 0f, this, thread.getLooper());
        } catch (SecurityException | IllegalArgumentException e) {
            return false;
        }
        listening = true;
        running = true;
        handler.removeCallbacks(tick);
        handler.postDelayed(tick, NOTIFY_EVERY_MS);
        return true;
    }

    private void shutdown() {
        running = false;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onLocationChanged(Location l) {
        TrackSession s = TrackSession.get(this);
        double before = s.distanceM();
        s.addPoint(
                System.currentTimeMillis(),
                l.getLatitude(),
                l.getLongitude(),
                l.hasAccuracy() ? l.getAccuracy() : Double.NaN,
                l.hasAltitude() ? l.getAltitude() : Double.NaN,
                l.hasSpeed() ? l.getSpeed() : Double.NaN);
        if (s.splitCue && TrackMath.splitsCrossed(before, s.distanceM(), s.splitM) > 0) cue();
    }

    // Older Android versions call these; nothing to do.
    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    /** Mile/km cue: a short buzz and beep. */
    private void cue() {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm == null ? null : vm.getDefaultVibrator();
            } else v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                long[] pattern = {0, 300, 150, 300};
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                else v.vibrate(pattern, -1);
            }
        } catch (RuntimeException ignored) {
            // No vibrator.
        }
        try {
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
            tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 400);
            handler.postDelayed(tg::release, 800);
        } catch (RuntimeException ignored) {
            // No audio.
        }
    }

    private void updateNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        try {
            if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(TrackSession.get(this)));
        } catch (RuntimeException ignored) {
            // Notifications not allowed: tracking continues.
        }
    }

    private Notification buildNotification(TrackSession s) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Activity tracking", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shown while RightPace tracks a run, walk or ride");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        boolean paused = s.paused();
        double unitM = "km".equals(s.unit) ? 1000 : 1609.344;
        String title = (paused ? "Paused " : "Tracking ") + s.noun + " · " + TrackMath.distance(s.distanceM(), unitM) + " " + s.unit + " · " + TrackMath.duration(s.activeMs(System.currentTimeMillis()));

        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent toggle = new Intent(this, ActivityTrackerService.class).setAction(paused ? ACTION_RESUME : ACTION_PAUSE);
        PendingIntent togglePi = PendingIntent.getService(this, 2, toggle, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_cutline)
                .setContentTitle(title)
                .setContentText(paused ? "Paused. Resume here or in the app." : "Screen can be off. Location stays on this phone.")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(openPi)
                .addAction(0, paused ? "Resume" : "Pause", togglePi)
                .addAction(0, "Open", openPi)
                .build();
    }

    @Override
    public void onDestroy() {
        running = false;
        if (locations != null && listening) {
            try {
                locations.removeUpdates(this);
            } catch (RuntimeException ignored) {
                // Already gone.
            }
        }
        listening = false;
        if (handler != null) handler.removeCallbacksAndMessages(null);
        TrackSession.get(this).flush();
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
