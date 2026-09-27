package com.joshdougherty.cutline.activity;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.List;

/** GPS activity tracking for the web app: permission, start/pause/resume/stop, and the recorded fixes. */
@CapacitorPlugin(
        name = "ActivityTracker",
        permissions = { @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }) })
public class ActivityTrackerPlugin extends Plugin {

    private boolean granted(String p) {
        return ContextCompat.checkSelfPermission(getContext(), p) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject locationStatus() {
        String permission;
        if (granted(Manifest.permission.ACCESS_FINE_LOCATION)) permission = "granted";
        else if (granted(Manifest.permission.ACCESS_COARSE_LOCATION)) permission = "coarse";
        else permission = getPermissionState("location") == PermissionState.DENIED ? "denied" : "prompt";
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean gpsOn = lm != null && lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        JSObject o = new JSObject();
        o.put("permission", permission);
        o.put("gpsOn", gpsOn);
        return o;
    }

    private JSObject session() {
        TrackSession s = TrackSession.get(getContext());
        JSObject o = new JSObject();
        synchronized (s) {
            o.put("active", s.active());
            o.put("running", ActivityTrackerService.running);
            JSArray ev = new JSArray();
            if (s.active()) {
                o.put("id", s.id);
                o.put("type", s.type);
                o.put("startedAt", s.startedAt);
                if (s.ended()) o.put("endedAt", s.endedAt);
                o.put("autoPause", s.autoPause);
                o.put("splitCue", s.splitCue);
                o.put("splitM", s.splitM);
                for (TrackMath.Event e : s.events) {
                    JSObject x = new JSObject();
                    x.put("t", e.t);
                    x.put("kind", e.kind);
                    ev.put(x);
                }
            }
            o.put("events", ev);
            o.put("pointCount", s.pointCount());
        }
        return o;
    }

    @PluginMethod
    public void checkLocation(PluginCall call) {
        call.resolve(locationStatus());
    }

    @PluginMethod
    public void requestLocation(PluginCall call) {
        if (granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            call.resolve(locationStatus());
            return;
        }
        requestPermissionForAlias("location", call, "locationDone");
    }

    @PermissionCallback
    private void locationDone(PluginCall call) {
        call.resolve(locationStatus());
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context c = getContext();
        if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            call.reject("Precise location permission is off.", "permission");
            return;
        }
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null || !lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            call.reject("Location is turned off.", "gps-off");
            return;
        }
        String id = call.getString("id");
        String type = call.getString("type", "run");
        if (id == null || id.isEmpty()) {
            call.reject("Missing id.");
            return;
        }
        Long startedAt = call.getLong("startedAt");
        Double splitM = call.getDouble("splitM");
        TrackSession.get(c).start(
                id,
                type,
                startedAt == null ? System.currentTimeMillis() : startedAt,
                Boolean.TRUE.equals(call.getBoolean("autoPause", true)),
                Boolean.TRUE.equals(call.getBoolean("splitCue", false)),
                splitM == null ? 1609.344 : splitM,
                call.getString("unit", "mi"),
                call.getString("noun", type));
        try {
            ActivityTrackerService.send(c, ActivityTrackerService.ACTION_START);
        } catch (RuntimeException e) {
            TrackSession.get(c).clear();
            call.reject("Could not start tracking: " + e.getMessage(), "failed");
            return;
        }
        call.resolve(session());
    }

    @PluginMethod
    public void pause(PluginCall call) {
        TrackSession.get(getContext()).event("pause", System.currentTimeMillis());
        refresh();
        call.resolve(session());
    }

    @PluginMethod
    public void resume(PluginCall call) {
        TrackSession.get(getContext()).event("resume", System.currentTimeMillis());
        refresh();
        call.resolve(session());
    }

    private void refresh() {
        if (!ActivityTrackerService.running) return;
        try {
            ActivityTrackerService.send(getContext(), ActivityTrackerService.ACTION_REFRESH);
        } catch (RuntimeException ignored) {
            // The notification catches up on its next tick.
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        TrackSession.get(getContext()).stop(System.currentTimeMillis());
        ActivityTrackerService.stop(getContext());
        call.resolve(session());
    }

    @PluginMethod
    public void getSession(PluginCall call) {
        call.resolve(session());
    }

    @PluginMethod
    public void getPoints(PluginCall call) {
        Integer from = call.getInt("from", 0);
        List<double[]> pts = TrackSession.get(getContext()).pointsFrom(from == null ? 0 : from);
        JSArray arr = new JSArray();
        for (double[] p : pts) {
            JSObject o = new JSObject();
            o.put("t", (long) p[0]);
            o.put("lat", p[1]);
            o.put("lon", p[2]);
            if (!Double.isNaN(p[3])) o.put("acc", p[3]);
            if (!Double.isNaN(p[4])) o.put("alt", p[4]);
            if (!Double.isNaN(p[5])) o.put("spd", p[5]);
            arr.put(o);
        }
        JSObject res = new JSObject();
        res.put("points", arr);
        call.resolve(res);
    }

    /** The app reopened with an active session and no running service (the app was killed): start it again. */
    @PluginMethod
    public void ensureRunning(PluginCall call) {
        Context c = getContext();
        TrackSession s = TrackSession.get(c);
        if (s.active() && !s.ended() && !ActivityTrackerService.running && granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            try {
                ActivityTrackerService.send(c, ActivityTrackerService.ACTION_RESTART);
            } catch (RuntimeException ignored) {
                // Stays stopped; the app shows the session anyway.
            }
        }
        call.resolve(session());
    }

    @PluginMethod
    public void clear(PluginCall call) {
        ActivityTrackerService.stop(getContext());
        TrackSession.get(getContext()).clear();
        call.resolve();
    }
}
