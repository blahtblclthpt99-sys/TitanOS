import { api } from "@/api/apiClient";
import { createFunctionsModule } from "@/api/functions";
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
  const payload = {
    owner_id: user.id,
    customer_id: data.customer_id || null,
    customer_name: data.customer_name || "",
    job_id: data.job_id || null,
    title: data.title || "Service Agreement",
    body: data.body || DEFAULT_BODY,
    status: "sent",
    share_token: null,
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

export async function createContractShareToken(contractId) {
  const result = await createFunctionsModule().invoke("contractShareToken", { contract_id: contractId });
  if (!result?.token) throw new Error("Could not create a signing link.");
  return result.token;
}

export async function getContractByToken(token) {
  if (!token || String(token).length < 32) return null;
  try {
    const result = await createFunctionsModule().invoke("publicContract", {
      action: "get",
      token: String(token),
    });
    return result?.contract || null;
  } catch {
    return null;
  }
}

export async function signContract(contract, { role, signature, signatureImage = "", shareToken = "" }) {
  if (role === "customer") {
    const token = String(shareToken || contract?.share_token || "");
    if (!token) throw new Error("Signing link is missing.");
    const result = await createFunctionsModule().invoke("publicContract", {
      action: "sign",
      token,
      signature,
      signature_image: signatureImage || null,
    });
    if (!result?.contract) throw new Error("Contract could not be signed.");
    return result.contract;
  }

  const updates = {
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

export async function deleteContract(ownerId, id) {
  try {
    await api.entities.Contract.delete(id);
  } catch {
    writeLocal(
      PREFIX,
      ownerId,
      "all",
      readLocal(PREFIX, ownerId, "all", []).filter((row) => row.id !== id)
    );
  }
}
