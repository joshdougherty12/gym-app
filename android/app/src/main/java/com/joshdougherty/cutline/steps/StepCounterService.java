package com.joshdougherty.cutline.steps;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import com.joshdougherty.cutline.MainActivity;
import com.joshdougherty.cutline.R;
import java.text.NumberFormat;

/**
 * Keeps the step counter registered while step counting is on. Android's step counter only
 * counts while some app has it registered, and on a phone without Google services nothing else
 * does, so this quiet foreground service holds it. Events are batched in the sensor hub (up to
 * five minutes), so the phone is not woken for each step.
 */
public class StepCounterService extends Service implements SensorEventListener {
    private static final String CHANNEL = "step-counting";
    private static final int NOTIFICATION_ID = 4301;
    private static final long WRITE_EVERY_MS = 60_000;
    private static final int MAX_LATENCY_US = 5 * 60 * 1_000_000;

    private HandlerThread thread;
    private Handler handler;
    private SensorManager sensors;
    private long lastWriteMs = 0;
    private long pendingCounter = -1;
    private long pendingAtMs = 0;
    private final Runnable flush = this::flushPending;

    /** Start (or keep) the service. Fails quietly where Android does not allow a start from the background. */
    static void start(Context c) {
        if (!StepStore.isEnabled(c) || !StepStore.hasPermission(c) || !StepStore.hasSensor(c)) return;
        try {
            Intent i = new Intent(c, StepCounterService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) c.startForegroundService(i);
            else c.startService(i);
        } catch (RuntimeException ignored) {
            // Background start not allowed right now; the periodic worker still samples.
        }
    }

    static void stop(Context c) {
        c.stopService(new Intent(c, StepCounterService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        thread = new HandlerThread("rightpace-steps");
        thread.start();
        handler = new Handler(thread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type);
        } catch (RuntimeException e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!StepStore.isEnabled(this) || !StepStore.hasPermission(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (sensors == null) {
            sensors = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            Sensor s = sensors == null ? null : sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (s == null || !sensors.registerListener(this, s, SensorManager.SENSOR_DELAY_NORMAL, MAX_LATENCY_US, handler)) {
                sensors = null;
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        if (e.values.length == 0) return;
        long now = System.currentTimeMillis();
        // Batched events carry the time they happened (boot-time clock); turn that into wall time.
        long at = now - (SystemClock.elapsedRealtimeNanos() - e.timestamp) / 1_000_000L;
        if (at > now || at < now - 24L * 3600 * 1000) at = now;
        pendingCounter = (long) e.values[0];
        pendingAtMs = at;
        if (now - lastWriteMs >= WRITE_EVERY_MS) flushPending();
        else {
            handler.removeCallbacks(flush);
            handler.postDelayed(flush, WRITE_EVERY_MS);
        }
    }

    private void flushPending() {
        if (pendingCounter < 0) return;
        StepStore.record(this, pendingCounter, pendingAtMs);
        pendingCounter = -1;
        lastWriteMs = System.currentTimeMillis();
        NotificationManager nm = getSystemService(NotificationManager.class);
        try {
            if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
        } catch (RuntimeException ignored) {
            // Notifications not allowed: counting continues.
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public void onDestroy() {
        if (sensors != null) sensors.unregisterListener(this);
        if (handler != null) {
            handler.removeCallbacks(flush);
            handler.post(this::flushPending);
        }
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Step counting", NotificationManager.IMPORTANCE_MIN);
            ch.setDescription("Shown while RightPace counts steps in the background");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String text = NumberFormat.getIntegerInstance().format(StepStore.today(this)) + " steps today";
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_cutline)
                .setContentTitle("Counting steps")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(pi)
                .build();
    }
}
