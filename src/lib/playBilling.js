import { Capacitor, registerPlugin } from "@capacitor/core";
import { createFunctionsModule } from "@/api/functions";

export const PLAY_SUBSCRIPTIONS = Object.freeze({
  starter: "titanos_starter_monthly",
  worker_premium: "titanos_pro_monthly",
  business: "titanos_business_monthly",
});

const TitanBilling = registerPlugin("TitanBilling");

export function isAndroidPlayBuild() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function accountHash(userId) {
  const bytes = new TextEncoder().encode(String(userId));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadPlaySubscriptions() {
  if (!isAndroidPlayBuild()) return [];
  const { products = [] } = await TitanBilling.queryProducts({ productIds: Object.values(PLAY_SUBSCRIPTIONS) });
  return products;
}

export async function startPlaySubscription(planId, userId) {
  if (!isAndroidPlayBuild()) throw new Error("Google Play checkout is only available in the Android app.");
  if (!userId) throw new Error("Sign in before choosing a plan.");
  const productId = PLAY_SUBSCRIPTIONS[planId];
  if (!productId) throw new Error("Unknown subscription plan.");
  return TitanBilling.purchase({ productId, obfuscatedAccountId: await accountHash(userId) });
}

export async function verifyPlayPurchase(purchase) {
  const productId = purchase?.products?.[0];
  if (!purchase?.purchaseToken || !productId) throw new Error("Google Play did not return a complete purchase.");
  return createFunctionsModule().invoke("googlePlayVerifySubscription", {
    packageName: "com.titanos.myapp",
    productId,
    purchaseToken: purchase.purchaseToken,
  });
}

export async function restorePlaySubscriptions() {
  if (!isAndroidPlayBuild()) return [];
  const { purchases = [] } = await TitanBilling.restorePurchases();
  return purchases;
}

export function onPlayPurchaseUpdated(listener) {
  return TitanBilling.addListener("purchaseUpdated", listener);
}
