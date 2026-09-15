const RESEND_ENDPOINT = "https://api.resend.com/emails";

function configuredMailer() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  if (!apiKey || !from) {
    const error = new Error("Signup confirmation email is not configured");
    error.code = "SIGNUP_MAIL_NOT_CONFIGURED";
    throw error;
  }
  return { apiKey, from };
}

async function deleteGeneratedUser(admin, userId) {
  if (!userId) return;
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // Best effort only. A later password-proven registration retry can recover
    // the still-unconfirmed account with a fresh product-owned OTP.
  }
}

export async function sendSignupVerificationOtp({ email, otp, deliveryKey }) {
  const { apiKey, from } = configuredMailer();
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": deliveryKey,
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Your TitanOS verification code",
          text: [
            `Your TitanOS verification code is ${otp}.`,
            "",
            "Enter this code in the TitanOS signup screen to finish creating your account.",
            "If you did not request this account, you can ignore this email.",
          ].join("\n"),
        }),
      });

      if (response.ok) return { accepted: true };

      const body = await response.text().catch(() => "");
      const error = new Error(`Signup confirmation provider rejected delivery (${response.status})`);
      error.code = "SIGNUP_MAIL_REJECTED";
      error.status = response.status;
      error.providerBody = body.slice(0, 240);
      return { accepted: false, error };
    } catch (error) {
      lastError = error;
      // Retry once with the same provider idempotency key. If the first request
      // was accepted but its response was lost, Resend must not send it twice.
    }
  }

  const error = new Error("Signup confirmation delivery could not be verified");
  error.code = "SIGNUP_MAIL_AMBIGUOUS";
  error.cause = lastError;
  return { accepted: false, error };
}

function validGeneratedOtp(data, expectedUserId = "") {
  const user = data?.user || null;
  const otp = String(data?.properties?.email_otp || "").trim();
  const hashed = String(data?.properties?.hashed_token || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const expectedMatches = !expectedUserId || String(user?.id || "") === String(expectedUserId);
  return user?.id && expectedMatches && /^\d{6}$/.test(otp) && hashed
    ? { user, otp, hashed }
    : null;
}

/**
 * Generates a fresh magic-link OTP for a user already known to exist. Callers
 * must independently prove that the account is the intended unconfirmed user
 * before invoking this helper (password proof or exact user-id/email binding).
 */
export async function sendExistingSignupOtp(admin, { email, expectedUserId = "" }) {
  configuredMailer();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  const generated = validGeneratedOtp(data, expectedUserId);
  if (!generated) {
    const contractError = new Error("Supabase did not return a valid resend verification code");
    contractError.code = "SIGNUP_RESEND_CONTRACT_INVALID";
    throw contractError;
  }

  const delivery = await sendSignupVerificationOtp({
    email,
    otp: generated.otp,
    deliveryKey: `titan_signup_resend_${generated.user.id}_${generated.hashed.slice(0, 32)}`,
  });
  if (!delivery.accepted) throw delivery.error;

  return { user: generated.user, verificationType: "magiclink" };
}

/**
 * Creates an unconfirmed Supabase signup and delivers its signup OTP through
 * Titan's transactional mail provider. generateLink creates the auth user but
 * does not send mail; this keeps mail delivery explicit and auditable.
 */
export async function createSignupWithConfirmation(admin, { email, password, fullName = "" }) {
  // Prove the mail dependency exists before creating an auth user.
  configuredMailer();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });
  if (error) throw error;

  const user = data?.user || null;
  const otp = String(data?.properties?.email_otp || "").trim();
  if (!user?.id || !/^\d{6}$/.test(otp)) {
    await deleteGeneratedUser(admin, user?.id);
    const contractError = new Error("Supabase did not return a valid signup verification code");
    contractError.code = "SIGNUP_OTP_CONTRACT_INVALID";
    throw contractError;
  }

  const delivery = await sendSignupVerificationOtp({
    email,
    otp,
    deliveryKey: `titan_signup_${user.id}`,
  });

  if (!delivery.accepted) {
    // If mail delivery cannot be proven, remove the generated unconfirmed user
    // so the person can retry registration cleanly. A provider-accepted but
    // response-lost email may arrive with a now-invalid code, but the next clean
    // attempt produces the authoritative replacement code instead of trapping
    // the email address behind an unreachable account.
    await deleteGeneratedUser(admin, user.id);
    throw delivery.error;
  }

  return { user, verificationType: "signup", delivery: "accepted" };
}
