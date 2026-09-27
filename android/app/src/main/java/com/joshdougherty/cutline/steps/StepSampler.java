package com.joshdougherty.cutline.steps;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.HandlerThread;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/** Reads the step counter once: register, take the first event, unregister. Blocks; never call on the main thread. */
final class StepSampler {
    private StepSampler() {}

    /** Reads and records one sample. Returns true if a reading arrived. */
    static boolean sampleAndRecord(Context c, long timeoutMs) {
        if (!StepStore.isEnabled(c) || !StepStore.hasPermission(c)) return false;
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) return false;
        Sensor sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (sensor == null) return false;
        HandlerThread thread = new HandlerThread("rightpace-step-sample");
        thread.start();
        CountDownLatch latch = new CountDownLatch(1);
        AtomicLong value = new AtomicLong(-1);
        SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                if (e.values.length > 0 && value.compareAndSet(-1, (long) e.values[0])) latch.countDown();
            }

            @Override
            public void onAccuracyChanged(Sensor s, int accuracy) {}
        };
        try {
            if (!sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, new Handler(thread.getLooper()))) return false;
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        } finally {
            sm.unregisterListener(listener);
            thread.quitSafely();
        }
        long v = value.get();
        if (v < 0) return false;
        StepStore.record(c, v, System.currentTimeMillis());
        return true;
    }
}
