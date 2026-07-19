import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_companies";

export async function listMyCompanies(userId) {
  try {
    const owned = await api.entities.Company.filter({ owner_id: userId });
    const memberships = await api.entities.CompanyMember.filter({ user_id: userId, status: "active" });
    const memberCompanies = [];
    for (const m of memberships) {
      try {
        const c = await api.entities.Company.get(m.company_id);
        if (c) memberCompanies.push({ ...c, member_role: m.role });
      } catch {
        /* skip */
      }
    }
    const map = new Map();
    [...owned.map((c) => ({ ...c, member_role: "owner" })), ...memberCompanies].forEach((c) => map.set(c.id, c));
    return [...map.values()];
  } catch {
    return readLocal(PREFIX, userId, "all", []);
  }
}

export async function createCompany(user, { name, city, state, phone, email }) {
  const payload = {
    name: name.trim(),
    city: city || user.city || "",
    state: state || user.state || "",
    phone: phone || user.phone || "",
    email: email || user.email || "",
    owner_id: user.id,
    created_by_id: user.id,
  };
  try {
    const company = await api.entities.Company.create(payload);
    await api.entities.CompanyMember.create({
      company_id: company.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      created_by_id: user.id,
    });
    return company;
  } catch {
    const company = { id: uid(), created_at: new Date().toISOString(), ...payload, member_role: "owner" };
    const all = readLocal(PREFIX, user.id, "all", []);
    all.unshift(company);
    writeLocal(PREFIX, user.id, "all", all);
    return company;
  }
}

export async function setActiveCompany(userId, companyId, updateMe) {
  try {
    await updateMe({ active_company_id: companyId || null });
  } catch {
    writeLocal(PREFIX, userId, "active", companyId || null);
  }
}

export async function inviteCompanyMember(companyId, userId, email, role = "member") {
  // Without invite emails to existing users, store invited stub by email in metadata via member row
  const payload = {
    company_id: companyId,
    user_id: email, // placeholder until invite accept maps to real user id
    role,
    status: "invited",
    created_by_id: userId,
  };
  try {
    return await api.entities.CompanyMember.create(payload);
  } catch {
    return { id: uid(), ...payload };
  }
}

export async function deleteCompany(userId, id) {
  try {
    await api.entities.Company.delete(id);
  } catch {
    writeLocal(
      PREFIX,
      userId,
      "all",
      readLocal(PREFIX, userId, "all", []).filter((row) => row.id !== id)
    );
  }
}
