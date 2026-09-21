package com.titanos.myapp;

import android.app.Activity;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "TitanBilling")
public class TitanBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String EVENT_PURCHASE_UPDATED = "purchaseUpdated";

    private final Object connectionLock = new Object();
    private final List<PendingBillingAction> pendingActions = new ArrayList<>();
    private BillingClient billingClient;
    private boolean connectionInFlight;
    private boolean destroyed;

    private static final class PendingBillingAction {
        final PluginCall call;
        final Runnable action;

        PendingBillingAction(PluginCall call, Runnable action) {
            this.call = call;
            this.action = action;
        }
    }

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();

        // Google Play recommends reconciling owned purchases when the app starts
        // or returns to the foreground. The retained event lets JS consume the
        // result once its listener is attached.
        ensureBillingReady(this::emitOwnedSubscriptions);
    }

    private void withBilling(PluginCall call, Runnable action) {
        ensureBillingReady(call, action);
    }

    private void ensureBillingReady(Runnable action) {
        ensureBillingReady(null, action);
    }

    private void ensureBillingReady(PluginCall call, Runnable action) {
        BillingClient client = billingClient;
        if (destroyed || client == null) {
            rejectIfPresent(call, "Google Play Billing is unavailable", BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE);
            return;
        }
        if (client.isReady()) {
            action.run();
            return;
        }

        synchronized (connectionLock) {
            if (destroyed || billingClient == null) {
                rejectIfPresent(call, "Google Play Billing is unavailable", BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE);
                return;
            }
            if (billingClient.isReady()) {
                action.run();
                return;
            }

            pendingActions.add(new PendingBillingAction(call, action));
            if (connectionInFlight) return;
            connectionInFlight = true;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingServiceDisconnected() {
                failPendingActions("Google Play Billing disconnected", BillingClient.BillingResponseCode.SERVICE_DISCONNECTED);
            }

            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    failPendingActions("Google Play Billing is unavailable", result.getResponseCode());
                    return;
                }
                runPendingActions();
            }
        });
    }

    private void runPendingActions() {
        List<PendingBillingAction> ready;
        synchronized (connectionLock) {
            connectionInFlight = false;
            ready = new ArrayList<>(pendingActions);
            pendingActions.clear();
        }
        for (PendingBillingAction pending : ready) {
            if (destroyed) {
                rejectIfPresent(pending.call, "Google Play Billing stopped", BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE);
                continue;
            }
            try {
                pending.action.run();
            } catch (RuntimeException error) {
                if (pending.call != null) pending.call.reject("Google Play Billing operation failed", error);
            }
        }
    }

    private void failPendingActions(String message, int responseCode) {
        List<PendingBillingAction> failed;
        synchronized (connectionLock) {
            connectionInFlight = false;
            failed = new ArrayList<>(pendingActions);
            pendingActions.clear();
        }
        for (PendingBillingAction pending : failed) {
            rejectIfPresent(pending.call, message, responseCode);
        }
    }

    private void rejectIfPresent(PluginCall call, String message, int responseCode) {
        if (call != null) call.reject(message, String.valueOf(responseCode));
    }

    private QueryProductDetailsParams queryParams(JSArray productIds) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (int i = 0; i < productIds.length(); i++) {
            String id = productIds.optString(i, "").trim();
            if (!id.isEmpty()) {
                products.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                );
            }
        }
        return QueryProductDetailsParams.newBuilder().setProductList(products).build();
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        JSArray ids = call.getArray("productIds", new JSArray());
        if (ids.length() == 0) {
            call.reject("At least one Google Play productId is required");
            return;
        }

        withBilling(call, () -> billingClient.queryProductDetailsAsync(queryParams(ids), (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                rejectIfPresent(call, "Could not load Google Play products", result.getResponseCode());
                return;
            }
            JSArray products = new JSArray();
            List<ProductDetails> details = detailsResult.getProductDetailsList();
            if (details != null) {
                for (ProductDetails detail : details) products.put(productJson(detail));
            }
            JSObject response = new JSObject();
            response.put("products", products);
            call.resolve(response);
        }));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "").trim();
        String accountId = call.getString("obfuscatedAccountId", "").trim();
        if (productId.isEmpty() || accountId.isEmpty()) {
            call.reject("productId and obfuscatedAccountId are required");
            return;
        }
        if (accountId.length() > 64) {
            call.reject("obfuscatedAccountId exceeds Google Play's 64-character limit");
            return;
        }

        JSArray ids = new JSArray();
        ids.put(productId);
        withBilling(call, () -> billingClient.queryProductDetailsAsync(queryParams(ids), (result, detailsResult) -> {
            List<ProductDetails> found = detailsResult.getProductDetailsList();
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || found == null || found.isEmpty()) {
                call.reject("Subscription is not available in Google Play");
                return;
            }

            ProductDetails detail = found.get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = detail.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) {
                call.reject("No eligible Google Play offer is available for this account");
                return;
            }

            Activity activity = getActivity();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
                call.reject("Google Play checkout cannot open while the app is not active");
                return;
            }

            ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
            BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(detail)
                .setOfferToken(offer.getOfferToken())
                .build();
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(item))
                .setObfuscatedAccountId(accountId)
                .build();
            BillingResult launch = billingClient.launchBillingFlow(activity, params);
            if (launch.getResponseCode() == BillingClient.BillingResponseCode.OK) call.resolve();
            else rejectIfPresent(call, "Could not open Google Play checkout", launch.getResponseCode());
        }));
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        withBilling(call, () -> billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectIfPresent(call, "Could not restore purchases", result.getResponseCode());
                    return;
                }
                JSObject response = new JSObject();
                response.put("purchases", purchasesJson(purchases));
                call.resolve(response);
            }
        ));
    }

    private void emitOwnedSubscriptions() {
        BillingClient client = billingClient;
        if (destroyed || client == null || !client.isReady()) return;
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                JSObject event = new JSObject();
                event.put("responseCode", result.getResponseCode());
                event.put("purchases", purchasesJson(purchases));
                event.put("source", "reconcile");
                notifyListeners(EVENT_PURCHASE_UPDATED, event, true);
            }
        );
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        ensureBillingReady(this::emitOwnedSubscriptions);
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        JSObject event = new JSObject();
        event.put("responseCode", result.getResponseCode());
        event.put("purchases", purchasesJson(purchases == null ? Collections.emptyList() : purchases));
        event.put("source", "purchase_flow");
        notifyListeners(EVENT_PURCHASE_UPDATED, event, true);
    }

    private JSArray purchasesJson(List<Purchase> purchases) {
        JSArray out = new JSArray();
        if (purchases == null) return out;
        for (Purchase purchase : purchases) {
            JSObject item = new JSObject();
            item.put("purchaseToken", purchase.getPurchaseToken());
            item.put("products", new JSArray(purchase.getProducts()));
            item.put("purchaseState", purchase.getPurchaseState());
            item.put("acknowledged", purchase.isAcknowledged());
            item.put("autoRenewing", purchase.isAutoRenewing());
            out.put(item);
        }
        return out;
    }

    private JSObject productJson(ProductDetails detail) {
        JSObject item = new JSObject();
        item.put("productId", detail.getProductId());
        item.put("name", detail.getName());
        item.put("description", detail.getDescription());
        JSArray offersJson = new JSArray();
        List<ProductDetails.SubscriptionOfferDetails> offers = detail.getSubscriptionOfferDetails();
        if (offers != null) {
            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                JSObject offerJson = new JSObject();
                offerJson.put("basePlanId", offer.getBasePlanId());
                offerJson.put("offerId", offer.getOfferId());
                offerJson.put("offerToken", offer.getOfferToken());
                JSArray phases = new JSArray();
                for (ProductDetails.PricingPhase phase : offer.getPricingPhases().getPricingPhaseList()) {
                    JSObject p = new JSObject();
                    p.put("formattedPrice", phase.getFormattedPrice());
                    p.put("billingPeriod", phase.getBillingPeriod());
                    p.put("recurrenceMode", phase.getRecurrenceMode());
                    phases.put(p);
                }
                offerJson.put("pricingPhases", phases);
                offersJson.put(offerJson);
            }
        }
        item.put("offers", offersJson);
        return item;
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        failPendingActions("Google Play Billing stopped", BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE);
        BillingClient client = billingClient;
        billingClient = null;
        if (client != null) client.endConnection();
        super.handleOnDestroy();
    }
}
