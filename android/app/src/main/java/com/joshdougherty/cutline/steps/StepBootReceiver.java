package com.joshdougherty.cutline.steps;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After a reboot or an app update: take a reading right away (new baseline) and restart counting. */
public class StepBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        Context c = context.getApplicationContext();
        if (!StepStore.isEnabled(c)) return;
        StepWorker.schedule(c);
        StepCounterService.start(c);
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                StepSampler.sampleAndRecord(c, 5000);
            } finally {
                pending.finish();
            }
        }).start();
    }
}
