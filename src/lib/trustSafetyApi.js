/**
 * Trust & Safety — verifications, 2FA, fraud signals, reports, blocks.
 * Local-first with optional Supabase sync via profiles / future tables.
 */
import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { pushNotification } from "@/lib/notificationsApi";

const PREFIX = "titanos_trust";

export const VERIFY_TYPES = [
  {
    id: "email",
    label: "Email verification",
    description: "Confirm ownership of your account email",
  },
  {
    id: "phone",
    label: "Phone verification",
    description: "Confirm your mobile number with a one-time code",
  },
  {
    id: "identity",
    label: "Identity verification",
    description: "Government ID photo for KYC review",
  },
  {
    id: "driver_license",
    label: "Driver license verification",
    description: "Upload license front/back for driving & insurance jobs",
  },
  {
    id: "insurance",
    label: "Insurance verification",
    description: "Certificate of insurance / liability proof",
  },
];

export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or abuse",
  "Fraudulent listing or job",
  "Fake reviews or credentials",
  "Impersonation",
  "Other",
];

function emptyTrust(userId) {
  return {
    user_id: userId,
    email: { status: "unverified", verified_at: null },
    phone: { status: "unverified", phone: "", verified_at: null, challenge: null },
    identity: { status: "unverified", document_url: "", notes: "", submitted_at: null },
    driver_license: {
      status: "unverified",
      front_url: "",
      back_url: "",
      number_last4: "",
      submitted_at: null,
    },
    insurance: {
      status: "unverified",
      document_url: "",
      carrier: "",
      policy_number: "",
      expires_at: "",
      submitted_at: null,
    },
    two_factor: {
      enabled: false,
      method: "app",
      secret: "",
      recovery_codes: [],
      enabled_at: null,
    },
    fraud: {
      score: 0,
      flags: [],
      last_checked_at: null,
    },
    updated_at: new Date().toISOString(),
  };
}

function readTrust(userId) {
  return readLocal(PREFIX, userId, "state", null) || emptyTrust(userId);
}

/** Sync snapshot of Trust & Safety state (local). */
export function getLocalTrustState(userId) {
  if (!userId) return emptyTrust("");
  return readTrust(userId);
}

function writeTrust(userId, state) {
  writeLocal(PREFIX, userId, "state", { ...state, updated_at: new Date().toISOString() });
}

function readReports() {
  return readLocal(PREFIX, "global", "reports", []);
}

function writeReports(rows) {
  writeLocal(PREFIX, "global", "reports", rows.slice(0, 300));
}

function readBlocks(userId) {
  return readLocal(PREFIX, userId, "blocks", []);
}

function writeBlocks(userId, rows) {
  writeLocal(PREFIX, userId, "blocks", rows);
}

/** Simple deterministic “authenticator” code for demo 2FA (6 digits, 30s window). */
export function totpCode(secret, at = Date.now()) {
  const window = Math.floor(at / 30000);
  let hash = 0;
  const input = `${secret}:${window}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return String(hash % 1000000).padStart(6, "0");
}

function randomSecret() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function recoveryCodes() {
  return Array.from({ length: 8 }, () =>
    `${uid().slice(0, 4)}-${uid().slice(0, 4)}`.toUpperCase()
  );
}

export async function getTrustState(user) {
  if (!user?.id) return emptyTrust("");
  const state = readTrust(user.id);

  // Sync email verification from auth session when possible
  try {
    const me = await api.auth.me();
    const confirmed =
      Boolean(me?.email_confirmed_at) ||
      Boolean(me?.confirmed_at) ||
      // Supabase user from session may expose email_confirmed_at on raw user only
      false;
    // Heuristic: if user can use the app with session, treat email as verified unless flagged
    if (me?.email && state.email.status !== "verified") {
      // Keep unverified until explicit verify — but mark "pending" if OTP flow used
    }
    if (confirmed && state.email.status !== "verified") {
      state.email = { status: "verified", verified_at: new Date().toISOString() };
      writeTrust(user.id, state);
    }
  } catch {
    /* ignore */
  }

  // If professional profile has verified insurance/credentials, reflect pending→approved lightly
  return state;
}

export async function markEmailVerified(userId) {
  const state = readTrust(userId);
  state.email = { status: "verified", verified_at: new Date().toISOString() };
  writeTrust(userId, state);
  return state;
}

export async function sendEmailVerification(user) {
  if (!user?.email) throw new Error("No email on account");
  try {
    await api.auth.resendOtp?.(user.email);
  } catch {
    /* local-only fallback */
  }
  const state = readTrust(user.id);
  state.email = { ...state.email, status: "pending" };
  writeTrust(user.id, state);
  return state;
}

export async function startPhoneVerification(user, phone) {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  if (cleaned.replace(/\D/g, "").length < 10) throw new Error("Enter a valid phone number");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const state = readTrust(user.id);
  state.phone = {
    status: "pending",
    phone: cleaned,
    verified_at: null,
    challenge: { code, sent_at: Date.now(), expires_at: Date.now() + 10 * 60 * 1000 },
  };
  writeTrust(user.id, state);
  // Demo: surface code in notification so testers can complete without SMS provider
  await pushNotification(user.id, {
    type: "account",
    category: "account",
    title: "Phone verification code",
    body: `Your TitanOS code is ${code}`,
    link: "/trust-safety",
  });
  return { state, demoCode: code };
}

export async function confirmPhoneVerification(user, code) {
  const state = readTrust(user.id);
  const challenge = state.phone?.challenge;
  if (!challenge || Date.now() > challenge.expires_at) {
    throw new Error("Code expired — request a new one");
  }
  if (String(code).trim() !== String(challenge.code)) {
    throw new Error("Incorrect verification code");
  }
  state.phone = {
    status: "verified",
    phone: state.phone.phone,
    verified_at: new Date().toISOString(),
    challenge: null,
  };
  writeTrust(user.id, state);
  runFraudCheck(user.id);
  return state;
}

export async function submitDocumentVerification(user, type, payload) {
  if (!["identity", "driver_license", "insurance"].includes(type)) {
    throw new Error("Unknown verification type");
  }
  const state = readTrust(user.id);
  state[type] = {
    ...state[type],
    ...payload,
    status: "pending",
    submitted_at: new Date().toISOString(),
  };
  writeTrust(user.id, state);

  // Queue for admin
  const reports = readReports();
  reports.unshift({
    id: uid(),
    kind: "verification",
    type,
    reporter_id: user.id,
    reporter_name: user.full_name || user.email,
    target_id: user.id,
    status: "open",
    body: `${type} verification submitted`,
    meta: payload,
    created_at: new Date().toISOString(),
  });
  writeReports(reports);
  runFraudCheck(user.id);
  return state;
}

export async function beginTwoFactorSetup(user) {
  const state = readTrust(user.id);
  const secret = randomSecret();
  const codes = recoveryCodes();
  state.two_factor = {
    enabled: false,
    method: "app",
    secret,
    recovery_codes: codes,
    enabled_at: null,
    pending: true,
  };
  writeTrust(user.id, state);
  return { secret, codes, sampleCode: totpCode(secret) };
}

export async function confirmTwoFactor(user, code) {
  const state = readTrust(user.id);
  const secret = state.two_factor?.secret;
  if (!secret) throw new Error("Start 2FA setup first");
  const expected = totpCode(secret);
  const ok =
    String(code).trim() === expected ||
    (state.two_factor.recovery_codes || []).includes(String(code).trim().toUpperCase());
  if (!ok) throw new Error("Invalid authenticator code");
  state.two_factor = {
    ...state.two_factor,
    enabled: true,
    pending: false,
    enabled_at: new Date().toISOString(),
  };
  writeTrust(user.id, state);
  runFraudCheck(user.id);
  return state;
}

export async function disableTwoFactor(user, code) {
  const state = readTrust(user.id);
  if (state.two_factor?.enabled) {
    const expected = totpCode(state.two_factor.secret);
    if (String(code).trim() !== expected) throw new Error("Enter a valid 2FA code to disable");
  }
  state.two_factor = {
    enabled: false,
    method: "app",
    secret: "",
    recovery_codes: [],
    enabled_at: null,
  };
  writeTrust(user.id, state);
  return state;
}

export function verifyTwoFactorChallenge(userId, code) {
  const state = readTrust(userId);
  if (!state.two_factor?.enabled) return true;
  const expected = totpCode(state.two_factor.secret);
  return (
    String(code).trim() === expected ||
    (state.two_factor.recovery_codes || []).includes(String(code).trim().toUpperCase())
  );
}

export function runFraudCheck(userId) {
  const state = readTrust(userId);
  const flags = [];
  let score = 0;

  if (state.email.status !== "verified") {
    flags.push({ id: "email_unverified", severity: "medium", label: "Email not verified" });
    score += 15;
  }
  if (state.phone.status !== "verified") {
    flags.push({ id: "phone_unverified", severity: "low", label: "Phone not verified" });
    score += 8;
  }
  if (!state.two_factor?.enabled) {
    flags.push({ id: "no_2fa", severity: "medium", label: "Two-factor authentication off" });
    score += 12;
  }
  if (state.identity.status === "unverified") {
    flags.push({ id: "no_identity", severity: "low", label: "Identity not submitted" });
    score += 5;
  }
  if (state.insurance.status === "rejected") {
    flags.push({ id: "insurance_rejected", severity: "high", label: "Insurance rejected" });
    score += 25;
  }
  if (state.driver_license.status === "rejected") {
    flags.push({ id: "dl_rejected", severity: "high", label: "License rejected" });
    score += 20;
  }

  // Velocity: many open reports against this user
  const against = readReports().filter(
    (r) => r.target_id === userId && r.kind === "user" && r.status === "open"
  );
  if (against.length >= 2) {
    flags.push({
      id: "report_velocity",
      severity: "high",
      label: `${against.length} open user reports`,
    });
    score += 20 * Math.min(against.length, 3);
  }

  state.fraud = {
    score: Math.min(100, score),
    flags,
    last_checked_at: new Date().toISOString(),
    level: score >= 50 ? "elevated" : score >= 25 ? "watch" : "low",
  };
  writeTrust(userId, state);
  return state.fraud;
}

export async function submitUserReport(reporter, { targetId, targetName, reason, details, link }) {
  if (!reporter?.id) throw new Error("Sign in to report");
  if (!targetId) throw new Error("Missing report target");
  if (targetId === reporter.id) throw new Error("You can't report yourself");

  const row = {
    id: uid(),
    kind: "user",
    reporter_id: reporter.id,
    reporter_name: reporter.full_name || reporter.email,
    target_id: targetId,
    target_name: targetName || "User",
    reason: reason || "Other",
    body: (details || "").trim(),
    link: link || "",
    status: "open",
    created_at: new Date().toISOString(),
  };
  const rows = readReports();
  rows.unshift(row);
  writeReports(rows);
  runFraudCheck(targetId);
  return row;
}

export async function listTrustReports({ status = "open" } = {}) {
  let rows = readReports();
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  return rows;
}

export async function resolveTrustReport(reportId, status = "resolved") {
  const rows = readReports().map((r) =>
    r.id === reportId ? { ...r, status, resolved_at: new Date().toISOString() } : r
  );
  writeReports(rows);
}

export async function blockUser(userId, targetId, targetName = "") {
  if (!userId || !targetId || userId === targetId) return;
  const rows = readBlocks(userId);
  if (rows.some((b) => b.target_id === targetId)) return rows;
  rows.unshift({
    id: uid(),
    target_id: targetId,
    target_name: targetName,
    created_at: new Date().toISOString(),
  });
  writeBlocks(userId, rows);
  return rows;
}

export async function unblockUser(userId, targetId) {
  writeBlocks(
    userId,
    readBlocks(userId).filter((b) => b.target_id !== targetId)
  );
  return readBlocks(userId);
}

export function listBlockedUsers(userId) {
  return readBlocks(userId);
}

export function isBlocked(userId, targetId) {
  if (!userId || !targetId) return false;
  return readBlocks(userId).some((b) => b.target_id === targetId);
}

export function verificationSummary(state) {
  const items = VERIFY_TYPES.map((t) => ({
    ...t,
    status: state?.[t.id]?.status || "unverified",
  }));
  const verified = items.filter((i) => i.status === "verified").length;
  return { items, verified, total: items.length, twoFactor: Boolean(state?.two_factor?.enabled) };
}

/** True when identity + at least one other check are verified (Titan Verified). */
export function isTitanVerifiedFromTrust(state) {
  if (!state) return false;
  const idOk =
    state.identity?.status === "verified" || state.drivers_license?.status === "verified";
  const extras = ["email", "phone", "insurance", "background"].filter(
    (k) => state[k]?.status === "verified"
  );
  return Boolean(idOk && extras.length >= 1);
}

/** Admin helper: approve/reject document verification */
export function setVerificationStatus(userId, type, status, notes = "") {
  const state = readTrust(userId);
  if (!state[type]) return state;
  state[type] = {
    ...state[type],
    status,
    review_notes: notes,
    reviewed_at: new Date().toISOString(),
    verified_at: status === "verified" ? new Date().toISOString() : state[type].verified_at,
  };
  writeTrust(userId, state);
  runFraudCheck(userId);
  return state;
}
