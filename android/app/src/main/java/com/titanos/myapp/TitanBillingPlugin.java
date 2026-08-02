package com.titanos.myapp;

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
import java.util.List;

@CapacitorPlugin(name = "TitanBilling")
public class TitanBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    private void withBilling(PluginCall call, Runnable action) {
        if (billingClient.isReady()) {
            action.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingServiceDisconnected() { }
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                else call.reject("Google Play Billing unavailable: " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
            }
        });
    }

    private QueryProductDetailsParams queryParams(JSArray productIds) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (int i = 0; i < productIds.length(); i++) {
            String id = productIds.optString(i, "");
            if (!id.isEmpty()) products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id).setProductType(BillingClient.ProductType.SUBS).build());
        }
        return QueryProductDetailsParams.newBuilder().setProductList(products).build();
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        JSArray ids = call.getArray("productIds", new JSArray());
        withBilling(call, () -> billingClient.queryProductDetailsAsync(queryParams(ids), (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Could not load Google Play products: " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
                return;
            }
            JSArray products = new JSArray();
            for (ProductDetails detail : detailsResult.getProductDetailsList()) products.put(productJson(detail));
            JSObject response = new JSObject();
            response.put("products", products);
            call.resolve(response);
        }));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        String accountId = call.getString("obfuscatedAccountId", "");
        if (productId.isEmpty() || accountId.isEmpty()) {
            call.reject("productId and obfuscatedAccountId are required");
            return;
        }
        JSArray ids = new JSArray(); ids.put(productId);
        withBilling(call, () -> billingClient.queryProductDetailsAsync(queryParams(ids), (result, detailsResult) -> {
            List<ProductDetails> found = detailsResult.getProductDetailsList();
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || found.isEmpty()) {
                call.reject("Subscription is not available in Google Play");
                return;
            }
            ProductDetails detail = found.get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = detail.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) {
                call.reject("No eligible Google Play offer is available for this account");
                return;
            }
            ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
            BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(detail).setOfferToken(offer.getOfferToken()).build();
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(java.util.Collections.singletonList(item))
                .setObfuscatedAccountId(accountId).build();
            BillingResult launch = billingClient.launchBillingFlow(getActivity(), params);
            if (launch.getResponseCode() == BillingClient.BillingResponseCode.OK) call.resolve();
            else call.reject("Could not open Google Play checkout: " + launch.getDebugMessage(), String.valueOf(launch.getResponseCode()));
        }));
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        withBilling(call, () -> billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Could not restore purchases: " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
                    return;
                }
                JSObject response = new JSObject(); response.put("purchases", purchasesJson(purchases)); call.resolve(response);
            }
        ));
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        JSObject event = new JSObject();
        event.put("responseCode", result.getResponseCode());
        event.put("debugMessage", result.getDebugMessage());
        event.put("purchases", purchasesJson(purchases == null ? new ArrayList<>() : purchases));
        notifyListeners("purchaseUpdated", event, true);
    }

    private JSArray purchasesJson(List<Purchase> purchases) {
        JSArray out = new JSArray();
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
        if (offers != null) for (ProductDetails.SubscriptionOfferDetails offer : offers) {
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
            offerJson.put("pricingPhases", phases); offersJson.put(offerJson);
        }
        item.put("offers", offersJson);
        return item;
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) billingClient.endConnection();
    }
}
