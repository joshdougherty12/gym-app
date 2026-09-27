package com.joshdougherty.cutline.steps;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Map;
import java.util.TreeMap;

/** Step counting for the web app: permission, on/off, and steps per day. */
@CapacitorPlugin(name = "StepCounter", permissions = { @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }) })
public class StepCounterPlugin extends Plugin {

    private String permission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "granted";
        PermissionState s = getPermissionState("activity");
        return s == null ? "prompt" : s.toString();
    }

    private JSObject status() {
        Context c = getContext();
        JSObject o = new JSObject();
        o.put("available", StepStore.hasSensor(c));
        o.put("permission", permission());
        o.put("enabled", StepStore.isEnabled(c));
        o.put("lastSampleAt", StepStore.lastSampleMs(c));
        return o;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || getPermissionState("activity") == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("activity", call, "permissionDone");
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Turn counting on: first reading is the baseline; then the service and the 15-minute worker keep it going. */
    @PluginMethod
    public void enable(PluginCall call) {
        Context c = getContext();
        if (!StepStore.hasSensor(c)) {
            call.reject("This phone has no step counter.", "unavailable");
            return;
        }
        if (!StepStore.hasPermission(c)) {
            call.reject("Physical activity permission is off.", "permission");
            return;
        }
        if (!StepStore.isEnabled(c)) StepStore.setEnabled(c, true);
        StepWorker.schedule(c);
        StepCounterService.start(c);
        getBridge().execute(() -> {
            StepSampler.sampleAndRecord(c, 5000);
            call.resolve(status());
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Context c = getContext();
        StepStore.setEnabled(c, false);
        StepWorker.cancel(c);
        StepCounterService.stop(c);
        call.resolve(status());
    }

    /** Take a fresh reading now (app opened or resumed) and make sure counting is running. */
    @PluginMethod
    public void sampleNow(PluginCall call) {
        Context c = getContext();
        if (StepStore.isEnabled(c)) {
            StepWorker.schedule(c);
            StepCounterService.start(c);
        }
        getBridge().execute(() -> {
            StepSampler.sampleAndRecord(c, 3000);
            call.resolve(status());
        });
    }

    @PluginMethod
    public void getDailySteps(PluginCall call) {
        String from = call.getString("from", "0000-00-00");
        String to = call.getString("to", "9999-99-99");
        TreeMap<String, Long> days = StepStore.days(getContext());
        JSArray arr = new JSArray();
        if (from.compareTo(to) > 0) {
            JSObject empty = new JSObject();
            empty.put("days", arr);
            call.resolve(empty);
            return;
        }
        for (Map.Entry<String, Long> e : days.subMap(from, true, to, true).entrySet()) {
            JSObject o = new JSObject();
            o.put("date", e.getKey());
            o.put("steps", e.getValue());
            arr.put(o);
        }
        JSObject res = new JSObject();
        res.put("days", arr);
        call.resolve(res);
    }

    @PluginMethod
    public void getToday(PluginCall call) {
        JSObject res = new JSObject();
        res.put("date", StepLedger.dateOf(System.currentTimeMillis(), java.util.TimeZone.getDefault()));
        res.put("steps", StepStore.today(getContext()));
        call.resolve(res);
    }
}
