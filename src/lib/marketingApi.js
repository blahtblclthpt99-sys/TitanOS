import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_marketing";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

const CHANNELS = ["facebook", "instagram", "google", "email", "flyer"];

export function generateMarketingCopy({ businessName = "Your business", service = "home services", city = "your area", channel = "facebook" }) {
  const name = businessName || "Your business";
  const templates = {
    facebook: {
      title: `${service} done right in ${city}`,
      body: `Need reliable ${service.toLowerCase()}? ${name} is booking this week.\n\n✅ Licensed & insured\n✅ Clear upfront pricing\n✅ Same-week availability\n\nMessage us or book online — we'll take it from there.`,
      cta: "Book now",
    },
    instagram: {
      title: `Before → After ✨`,
      body: `${name} | ${city}\n${service} that actually lasts.\n\nTag a neighbor who needs this 👇\n#${city.replace(/\s/g, "")} #${service.replace(/\s/g, "")} #LocalPro`,
      cta: "Link in bio",
    },
    google: {
      title: `Professional ${service} in ${city}`,
      body: `${name} provides trusted ${service.toLowerCase()} for homeowners and businesses in ${city}. Fast quotes, clean workmanship, and clear communication from first call to final walkthrough.`,
      cta: "Request a quote",
    },
    email: {
      title: `Quick update from ${name}`,
      body: `Hi {{first_name}},\n\nSpring is a great time to schedule ${service.toLowerCase()}. We're opening a few slots in ${city} this month and wanted to give past clients first dibs.\n\nReply to this email or book online — happy to help.\n\n— ${name}`,
      cta: "Schedule service",
    },
    flyer: {
      title: `${name}`,
      body: `${service.toUpperCase()}\nServing ${city}\n\nFree estimates · Quality work · Fair prices\n\nCall or text today`,
      cta: "Scan to book",
    },
  };
  return { channel, ...(templates[channel] || templates.facebook) };
}

export async function listMarketingAssets(userId) {
  try {
    return await api.entities.MarketingAsset.filter({ user_id: userId }, "-created_date");
  } catch {
    return local(userId);
  }
}

export async function createMarketingAsset(user, values) {
  const row = {
    status: "draft",
    channel: "facebook",
    ...values,
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return await api.entities.MarketingAsset.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return item;
  }
}

export async function updateMarketingAsset(userId, id, values) {
  try {
    return await api.entities.MarketingAsset.update(id, values);
  } catch {
    const item = { ...local(userId).find((r) => r.id === id), ...values };
    save(userId, local(userId).map((r) => (r.id === id ? item : r)));
    return item;
  }
}

export async function deleteMarketingAsset(userId, id) {
  try {
    await api.entities.MarketingAsset.delete(id);
  } catch {
    save(userId, local(userId).filter((r) => r.id !== id));
  }
}

export { CHANNELS };
