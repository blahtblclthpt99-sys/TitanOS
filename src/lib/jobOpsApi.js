import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_jobops";

export async function listJobPhotos(jobId) {
  try {
    return await api.entities.JobPhoto.filter({ job_id: jobId });
  } catch {
    return readLocal(PREFIX, jobId, "photos", []);
  }
}

export async function addJobPhoto(user, { jobId, kind, url, caption }) {
  const payload = {
    job_id: jobId,
    kind: kind || "after",
    url,
    caption: caption || "",
    created_by_id: user.id,
  };
  try {
    return await api.entities.JobPhoto.create(payload);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, jobId, "photos", []);
    all.unshift(row);
    writeLocal(PREFIX, jobId, "photos", all);
    return row;
  }
}

export async function listCheckins(jobId) {
  try {
    return await api.entities.JobCheckin.filter({ job_id: jobId });
  } catch {
    return readLocal(PREFIX, jobId, "checkins", []);
  }
}

export async function recordCheckin(user, { jobId, eventType, note }) {
  let lat = null;
  let lng = null;
  let accuracy_m = null;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation unavailable"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
      });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy_m = pos.coords.accuracy;
  } catch {
    /* allow check-in without GPS */
  }

  const payload = {
    job_id: jobId,
    user_id: user.id,
    event_type: eventType,
    lat,
    lng,
    accuracy_m,
    note: note || "",
    created_by_id: user.id,
  };

  try {
    return await api.entities.JobCheckin.create(payload);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, jobId, "checkins", []);
    all.unshift(row);
    writeLocal(PREFIX, jobId, "checkins", all);
    return row;
  }
}
