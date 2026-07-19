import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { notifyUser } from "@/lib/notify";

const PREFIX = "titanos_contracts";

const DEFAULT_BODY = `SERVICE AGREEMENT

This agreement is between the Service Provider and the Customer for the work described below.

1. Scope of Work: As agreed between the parties.
2. Payment: Due upon completion unless otherwise stated.
3. Changes: Extra work requires written approval.
4. Liability: Provider carries appropriate insurance where required.
5. Signatures: By signing, both parties agree to these terms.

Free During Beta — TitanOS digital contracts.`;

export async function listContracts(ownerId) {
  try {
    return await api.entities.Contract.filter({ owner_id: ownerId });
  } catch {
    return readLocal(PREFIX, ownerId, "all", []);
  }
}

export async function createContract(user, data) {
  const token =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : uid().replace(/-/g, "") + uid().replace(/-/g, "");
  const payload = {
    owner_id: user.id,
    customer_id: data.customer_id || null,
    customer_name: data.customer_name || "",
    job_id: data.job_id || null,
    title: data.title || "Service Agreement",
    body: data.body || DEFAULT_BODY,
    status: "sent",
    share_token: token,
    created_by_id: user.id,
  };
  try {
    return await api.entities.Contract.create(payload);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, user.id, "all", []);
    all.unshift(row);
    writeLocal(PREFIX, user.id, "all", all);
    return row;
  }
}

export async function getContractByToken(token) {
  if (!token || String(token).length < 16) return null;
  try {
    const { supabase } = await import("@/api/supabaseClient");
    const { data, error } = await supabase.rpc("get_contract_by_share_token", { p_token: token });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return row;
    }
  } catch {
    /* fall through */
  }
  try {
    // Fallback for environments without migration 012 yet (owner-authenticated only)
    const rows = await api.entities.Contract.filter({ share_token: token });
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function signContract(contract, { role, signature, signatureImage = "" }) {
  if (role === "customer" && contract.share_token) {
    try {
      const { supabase } = await import("@/api/supabaseClient");
      const { data, error } = await supabase.rpc("sign_contract_by_share_token", {
        p_token: contract.share_token,
        p_signature: signature,
        p_signature_image: signatureImage || null,
      });
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) return row;
      }
    } catch {
      /* fall through to entity update */
    }
  }

  const updates =
    role === "customer"
      ? {
          customer_signature: signature,
          customer_signature_image: signatureImage || null,
          status: contract.owner_signature ? "signed" : "sent",
          signed_at: contract.owner_signature ? new Date().toISOString() : null,
          signed_user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        }
      : {
          owner_signature: signature,
          owner_signature_image: signatureImage || null,
          status: contract.customer_signature ? "signed" : "sent",
          signed_at: contract.customer_signature ? new Date().toISOString() : null,
          signed_user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        };

  try {
    const row = await api.entities.Contract.update(contract.id, updates);
    if (row.status === "signed" && contract.owner_id) {
      await notifyUser(contract.owner_id, {
        type: "estimates",
        title: "Contract signed",
        body: `${contract.title} was fully signed.`,
        link: "/contracts",
      });
    }
    return row;
  } catch {
    return { ...contract, ...updates };
  }
}

export function contractPublicUrl(token) {
  if (typeof window === "undefined") return `/sign/${token}`;
  return `${window.location.origin}/sign/${token}`;
}
