package com.titanos.myapp;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

/**
 * Android 15+ (targetSdk 35+) draws edge-to-edge by default.
 * Call EdgeToEdge.enable() for consistent behavior across API levels.
 * Web UI already pads with env(safe-area-inset-*) + viewport-fit=cover.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
