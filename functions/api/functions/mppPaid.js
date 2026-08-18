// MPP is intentionally isolated from the Cloudflare core Worker until the
// upstream machine-payment SDK is Worker-compatible. Standard Titan Stripe
// checkout, subscriptions, portal, and webhook routes remain available.
export async function onRequest() {
  return Response.json(
    {
      error: "Machine Payments Protocol is temporarily unavailable on this host",
      code: "mpp_worker_unavailable",
      service: "titanos-mpp",
      alternative: "standard_stripe",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    }
  );
}
