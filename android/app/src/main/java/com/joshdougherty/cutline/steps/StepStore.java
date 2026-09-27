package com.joshdougherty.cutline.steps;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import java.util.TimeZone;
import java.util.TreeMap;

/** The step ledger saved in SharedPreferences, shared by the plugin, the service, the worker and the boot receiver. */
final class StepStore {
    private static final String PREFS = "rightpace_steps";
    private static final String KEY_LEDGER = "ledger";
    private static final String KEY_ENABLED = "enabled";
    private static final Object LOCK = new Object();

    private StepStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context c) {
        return prefs(c).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context c, boolean on) {
        synchronized (LOCK) {
            StepLedger l = StepLedger.parse(prefs(c).getString(KEY_LEDGER, null));
            l.clearBaseline();
            prefs(c).edit().putBoolean(KEY_ENABLED, on).putString(KEY_LEDGER, l.serialize()).commit();
        }
    }

    static boolean hasSensor(Context c) {
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    static boolean hasPermission(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Record a counter reading taken at `sampleMs` (wall clock). Returns steps added. */
    static long record(Context c, long counter, long sampleMs) {
        long bootMs = System.currentTimeMillis() - SystemClock.elapsedRealtime();
        int bootCount = Settings.Global.getInt(c.getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        synchronized (LOCK) {
            if (!isEnabled(c)) return 0;
            StepLedger l = StepLedger.parse(prefs(c).getString(KEY_LEDGER, null));
            long added = l.record(counter, sampleMs, bootMs, bootCount, TimeZone.getDefault());
            prefs(c).edit().putString(KEY_LEDGER, l.serialize()).commit();
            return added;
        }
    }

    static TreeMap<String, Long> days(Context c) {
        synchronized (LOCK) {
            return StepLedger.parse(prefs(c).getString(KEY_LEDGER, null)).days;
        }
    }

    static long today(Context c) {
        Long v = days(c).get(StepLedger.dateOf(System.currentTimeMillis(), TimeZone.getDefault()));
        return v == null ? 0 : v;
    }

    static long lastSampleMs(Context c) {
        synchronized (LOCK) {
            return StepLedger.parse(prefs(c).getString(KEY_LEDGER, null)).lastSampleMs;
        }
    }
}
