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
  const token = uid().replace(/-/g, "").slice(0, 16);
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
  try {
    const rows = await api.entities.Contract.filter({ share_token: token });
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function signContract(contract, { role, signature }) {
  const updates =
    role === "customer"
      ? {
          customer_signature: signature,
          status: contract.owner_signature ? "signed" : "sent",
          signed_at: contract.owner_signature ? new Date().toISOString() : null,
        }
      : {
          owner_signature: signature,
          status: contract.customer_signature ? "signed" : "sent",
          signed_at: contract.customer_signature ? new Date().toISOString() : null,
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
