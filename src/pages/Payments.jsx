import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router";
import { CreditCard, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import ExportMenu from "@/components/shared/ExportMenu";
import { paymentsExportSpec } from "@/lib/export";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import FormField from "@/components/shared/FormField";
import NativeSelect from "@/components/shared/NativeSelect";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";
import { calcPlatformFee, formatMoney } from "@/lib/platformFee";
import { getPlanConfig } from "@/lib/plan";
import { createPaymentLink, deletePayment, listPaymentAccounts, listPayments, markPaymentStatus, upsertPaymentAccount } from "@/lib/paymentsApi";
import { getSource, DATA_SOURCE, isLocalOrStub } from "@/lib/dataSource";
import DeleteButton from "@/components/shared/DeleteButton";
import EmptyState from "@/components/shared/EmptyState";
import PageLoader from "@/components/shared/PageLoader";

const PROVIDERS = ["stripe"];
const EMPTY_FORM = { amount: "", customer_name: "", invoice_id: "", provider: "stripe" };
const statusClass = {
  succeeded: "bg-emerald-400/15 text-emerald-300",
  failed: "bg-red-400/15 text-red-300",
  pending: "bg-titan-amber/15 text-titan-amber",
};

function formFromPrefill(source = {}) {
  const amount = source.amount ?? source.balance_due ?? source.total;
  return {
    ...EMPTY_FORM,
    amount: amount != null && amount !== "" ? String(amount) : "",
    customer_name: source.customer_name || "",
    invoice_id: source.invoice_id || source.id || "",
    provider: source.provider || "stripe",
  };
}

export default function Payments() {
  const location = useLocation();
  const { user, authChecked } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deviceOnly, setDeviceOnly] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = {
      amount: params.get("amount") || "",
      customer_name: params.get("customer_name") || "",
      invoice_id: params.get("invoice_id") || "",
    };
    const prefill = location.state?.invoice || location.state || fromQuery;
    if (prefill?.amount || prefill?.customer_name || prefill?.invoice_id || prefill?.id) {
      setForm(formFromPrefill(prefill));
    }
  }, [location.state, location.search]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [accountRows, paymentRows] = await Promise.all([listPaymentAccounts(user.id), listPayments(user.id)]);
      setDeviceOnly(
        getSource(accountRows) === DATA_SOURCE.local || getSource(paymentRows) === DATA_SOURCE.local
      );
      setAccounts(accountRows);
      setPayments(
        paymentRows.sort(
          (a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date)
        )
      );
    } catch {
      toast({ variant: "destructive", title: "Couldn't load payments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    load();
  }, [authChecked, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "1";
    const canceled = params.get("canceled") === "1";
    if (!success && !canceled) return;
    if (success) {
      toast({
        title: "Checkout returned success",
        description: "Confirm in your Stripe dashboard — TitanOS marks paid only via webhook.",
      });
    } else {
      toast({ title: "Payment canceled" });
    }
    params.delete("success");
    params.delete("canceled");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, []);

  const toggleProvider = async (provider) => {
    if (saving) return;
    setSaving(true);
    try {
      const existing = accounts.find((account) => account.provider === provider);
      const account = await upsertPaymentAccount(user, {
        provider,
        account_label: provider[0].toUpperCase() + provider.slice(1),
        is_connected: !existing?.is_connected,
      });
      setAccounts((current) => [...current.filter((item) => item.provider !== provider), account]);
      toast({
        title: account.is_connected
          ? `${provider}: marked connected (app flag only)`
          : `${provider}: marked disconnected`,
        description:
          getSource(account) === DATA_SOURCE.local
            ? "Saved on this device only — not a live provider OAuth connection."
            : provider === "stripe"
              ? "Live Stripe Checkout still needs a configured server secret key."
              : "This does not OAuth into Square/PayPal yet — preference flag only.",
      });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update payment account" });
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !Number(form.amount) || !form.customer_name.trim()) return;
    setSaving(true);
    try {
      const payment = await createPaymentLink(user, {
        ...form,
        amount: Number(form.amount),
        customer_name: form.customer_name.trim(),
      });
      if (isLocalOrStub(payment) || !payment.checkout_url) {
        toast({
          variant: "destructive",
          title: "No live payment link",
          description: "Checkout was not created. Configure Stripe on the server — nothing was charged.",
        });
        return;
      }
      setPayments((current) => [payment, ...current]);
      setForm(EMPTY_FORM);
      const fee = Number(payment.platform_fee || 0);
      const feeLabel = payment.fee_label || getPlanConfig(user).feeLabel;
      toast({
        title: "Payment link created",
        description: fee
          ? `Includes ${feeLabel} TitanOS fee (${formatMoney(fee)}). Opening checkout…`
          : "Opening checkout…",
      });
      window.open(payment.checkout_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't create payment link",
        description: error.message || "Live checkout unavailable.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (payment, status) => {
    if (saving) return;
    if (status === "succeeded" || status === "refunded" || status === "paid") {
      toast({
        variant: "destructive",
        title: "Webhook only",
        description: "Paid status comes from Stripe after checkout — it cannot be set in the browser.",
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await markPaymentStatus(payment.id, status);
      setPayments((current) =>
        current.map((item) => (item.id === payment.id ? { ...item, status: saved.status || status } : item))
      );
      toast({
        title: "Payment updated",
        description: `Status set to ${saved.status || status}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't update payment",
        description: error.message || "Status was not changed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const plan = getPlanConfig(user);
  const feePreview = Number(form.amount) > 0 ? calcPlatformFee(form.amount, user) : null;

  if (authChecked && !user?.id) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
        <PageHeader title="Payments" subtitle="Collect payments with Stripe Checkout" />
        <EmptyState
          title="Sign in to manage payments"
          description="Payment links and history require an account."
          actionLabel="Sign in"
          onAction={() => {
            window.location.href = "/login";
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
      <PageHeader
        title="Payments"
        subtitle="Checkout is live when Stripe is configured — paid status comes only from the Stripe webhook"
        actions={<ExportMenu spec={paymentsExportSpec(payments)} size="sm" />}
      />
      <FeatureHonestyBanner>
        Stripe Checkout collects live payments when configured. TitanOS never marks a payment paid from the
        browser — only the Stripe webhook can set succeeded/refunded. Creating a link fails closed unless
        Stripe returns a real checkout URL.
        {deviceOnly
          ? " Payment records below are from this device — the payments table was unreachable."
          : ""}
      </FeatureHonestyBanner>
      <div className="titan-surface p-4 mb-6 border border-titan-cyan/20 text-sm text-foreground/90">
        <span className="text-titan-cyan font-semibold">
          Your plan: {plan.name} · {plan.feeLabel} fee
        </span>
        {" "}on every payment collected through the app
        {plan.id === "worker_free" ? (
          <>
            {" · "}
            <Link to="/pricing" className="text-titan-cyan underline-offset-2 hover:underline">
              Upgrade to cut fees to 2.5%
            </Link>
          </>
        ) : null}
        {betaBadgeLabel() ? ` · ${betaBadgeLabel()}` : ""}.
      </div>

      <section className="grid md:grid-cols-3 gap-4 mb-7">
        {PROVIDERS.map((provider) => {
          const connected = accounts.find((account) => account.provider === provider)?.is_connected;
          return (
            <article key={provider} className="titan-surface p-5 border border-border">
              <div className="flex items-center justify-between">
                <CreditCard className="w-5 h-5 text-titan-cyan" />
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    connected ? "bg-emerald-400/15 text-emerald-300" : "bg-muted text-foreground/45"
                  }`}
                >
                  {connected
                    ? provider === "stripe"
                      ? "Flagged connected"
                      : "Flagged (local)"
                    : "Not connected"}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-foreground capitalize mt-4">{provider}</h2>
              <p className="text-xs text-muted-foreground mt-1 min-h-8">
                {provider === "stripe"
                  ? "Stripe Checkout is live when your secret key is configured on the server."
                  : "Square and PayPal OAuth are not available yet. Use Stripe Checkout for live payments."}
              </p>
              {provider === "stripe" ? (
                <Button
                  onClick={() => toggleProvider(provider)}
                  disabled={saving}
                  variant="outline"
                  className="mt-4 w-full border-border text-foreground"
                >
                  {connected ? "Clear preference" : "Remember Stripe preference"}
                </Button>
              ) : (
                <Button disabled variant="outline" className="mt-4 w-full border-border text-muted-foreground">
                  Coming soon
                </Button>
              )}
            </article>
          );
        })}
      </section>

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={submit} className="titan-surface p-6 border border-border lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-foreground">Create payment link</h2>
          <FormField
            label="Amount ($)"
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          {feePreview && (
            <div className="rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Invoice amount</span>
                <span className="text-foreground">{formatMoney(feePreview.base)}</span>
              </div>
              <div className="flex justify-between">
                <span>TitanOS fee ({feePreview.percentLabel})</span>
                <span className="text-titan-cyan">{formatMoney(feePreview.fee)}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
                <span>Customer pays</span>
                <span>{formatMoney(feePreview.total)}</span>
              </div>
            </div>
          )}
          <FormField
            label="Customer name"
            required
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          />
          <FormField
            label="Invoice ID"
            hint="Optional"
            value={form.invoice_id}
            onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}
          />
          <FormField label="Provider">
            <NativeSelect
              value={form.provider}
              onValueChange={(provider) => setForm({ ...form, provider })}
              placeholder="Provider"
              options={PROVIDERS.map((value) => ({ value, label: value }))}
            />
          </FormField>
          <Button disabled={saving} type="submit" className="w-full min-h-[44px]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create payment link"}
          </Button>
        </form>

        <section className="titan-surface p-6 border border-border lg:col-span-3">
          <h2 className="font-semibold text-foreground mb-4">Payment history</h2>
          {loading ? (
            <PageLoader variant="list" label="Loading payments" />
          ) : payments.length ? (
            <div className="space-y-3">
              {payments.map((payment) => {
                const total = Number(payment.amount_total ?? payment.amount ?? 0);
                const fee = Number(payment.platform_fee || 0);
                const base = Number(payment.base_amount ?? (fee ? total - fee : total));
                return (
                  <div
                    key={payment.id}
                    className="rounded-xl bg-muted/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {payment.customer_name || "Customer"} · {formatMoney(total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        {payment.provider}
                        {payment.invoice_id ? ` · ${payment.invoice_id}` : ""}
                        {fee > 0 ? ` · fee ${formatMoney(fee)} on ${formatMoney(base)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs capitalize px-2 py-1 rounded-full ${
                          statusClass[payment.status] || statusClass.pending
                        }`}
                      >
                        {payment.status || "pending"}
                      </span>
                      {payment.checkout_url && (
                        <a
                          href={payment.checkout_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-titan-cyan"
                          aria-label={`Open Stripe checkout for ${payment.customer_name || "payment"}`}
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                      )}
                      {payment.status === "pending" && (
                        <button
                          onClick={() => updateStatus(payment, "canceled")}
                          aria-label="Mark canceled"
                          disabled={saving}
                          title="Cancel this pending payment record (does not refund Stripe)"
                        >
                          <XCircle className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                      <DeleteButton
                        label={`payment for ${payment.customer_name || "customer"}`}
                        onDelete={async () => {
                          await deletePayment(user.id, payment.id);
                          setPayments((prev) => prev.filter((p) => p.id !== payment.id));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No payments yet"
              description="Create a Stripe checkout link above. Paid status updates only after a successful webhook."
            />
          )}
        </section>
      </div>
    </div>
  );
}
