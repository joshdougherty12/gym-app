package com.joshdougherty.cutline;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.joshdougherty.cutline.activity.ActivityTrackerPlugin;
import com.joshdougherty.cutline.steps.StepCounterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StepCounterPlugin.class);
        registerPlugin(ActivityTrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
