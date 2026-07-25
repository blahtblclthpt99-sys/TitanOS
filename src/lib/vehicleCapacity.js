/**
 * Vehicle capacity — modular schema, validation, fit estimates, job matching.
 * Dimensions stored internally in inches; weights in pounds.
 * Do not invent manufacturer specs — only use driver-entered values.
 */

export const VEHICLE_CAPACITY_SCHEMA_VERSION = 1;

export const UNIT_SYSTEMS = [
  { id: "imperial", label: "Feet / inches · pounds" },
  { id: "metric", label: "Meters / cm · kilograms" },
];

export const DRIVE_TYPE_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "FWD", label: "Front-wheel drive" },
  { value: "RWD", label: "Rear-wheel drive" },
  { value: "AWD", label: "All-wheel drive" },
  { value: "4WD", label: "Four-wheel drive" },
];

export const CARGO_CONFIG_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "enclosed", label: "Enclosed cargo area" },
  { value: "open_bed", label: "Open bed" },
  { value: "flatbed", label: "Flatbed" },
  { value: "refrigerated", label: "Refrigerated" },
  { value: "curtain_side", label: "Curtain / soft side" },
];

/** Approximate catalog for “What fits?” — estimates only (inches + lb). */
const FIT_CATALOG = [
  { id: "moving_boxes", label: "Moving boxes", L: 18, W: 18, H: 18, weightLb: 40, category: "boxes" },
  { id: "small_furniture", label: "Small furniture (nightstand, chair)", L: 30, W: 24, H: 36, weightLb: 50, category: "furniture" },
  { id: "large_furniture", label: "Large furniture (sofa section, dresser)", L: 84, W: 36, H: 36, weightLb: 200, category: "furniture" },
  { id: "office_desk", label: "Office desk", L: 60, W: 30, H: 30, weightLb: 120, category: "office" },
  { id: "office_chair", label: "Office chair", L: 28, W: 28, H: 48, weightLb: 45, category: "office" },
  { id: "tv_55", label: "TV (up to ~55\")", L: 50, W: 8, H: 30, weightLb: 40, category: "electronics" },
  { id: "tv_75", label: "TV (up to ~75\")", L: 66, W: 8, H: 40, weightLb: 70, category: "electronics" },
  { id: "refrigerator", label: "Refrigerator", L: 36, W: 36, H: 72, weightLb: 300, category: "appliances" },
  { id: "washer", label: "Washer", L: 30, W: 30, H: 42, weightLb: 200, category: "appliances" },
  { id: "dryer", label: "Dryer", L: 30, W: 30, H: 42, weightLb: 150, category: "appliances" },
  { id: "mattress_twin", label: "Twin mattress", L: 75, W: 39, H: 12, weightLb: 50, category: "mattress" },
  { id: "mattress_full", label: "Full mattress", L: 75, W: 54, H: 12, weightLb: 70, category: "mattress" },
  { id: "mattress_queen", label: "Queen mattress", L: 80, W: 60, H: 12, weightLb: 90, category: "mattress" },
  { id: "mattress_king", label: "King mattress", L: 80, W: 76, H: 12, weightLb: 110, category: "mattress" },
  { id: "bicycle", label: "Bicycle", L: 70, W: 24, H: 42, weightLb: 30, category: "wheels" },
  { id: "motorcycle", label: "Motorcycle (estimate)", L: 90, W: 36, H: 48, weightLb: 450, category: "wheels" },
  { id: "pallet", label: "Standard pallet (estimate)", L: 48, W: 40, H: 48, weightLb: 500, category: "freight" },
  { id: "lumber_bundle", label: "Construction lumber / materials", L: 96, W: 24, H: 24, weightLb: 200, category: "materials" },
  { id: "landscaping", label: "Landscaping supplies (bags / sod)", L: 48, W: 36, H: 24, weightLb: 250, category: "materials" },
];

const JOB_TYPES = [
  {
    id: "courier",
    label: "Courier / small parcel",
    minPayloadLb: 0,
    maxPayloadLb: 200,
    minVolumeCuFt: 0,
    minLengthIn: 0,
  },
  {
    id: "small_delivery",
    label: "Small deliveries",
    minPayloadLb: 0,
    maxPayloadLb: 800,
    minVolumeCuFt: 20,
    minLengthIn: 36,
  },
  {
    id: "retail",
    label: "Retail deliveries",
    minPayloadLb: 100,
    maxPayloadLb: 2500,
    minVolumeCuFt: 40,
    minLengthIn: 48,
  },
  {
    id: "furniture",
    label: "Furniture delivery",
    minPayloadLb: 150,
    maxPayloadLb: 4000,
    minVolumeCuFt: 80,
    minLengthIn: 72,
  },
  {
    id: "appliance",
    label: "Appliance delivery",
    minPayloadLb: 200,
    maxPayloadLb: 4000,
    minVolumeCuFt: 60,
    minLengthIn: 36,
  },
  {
    id: "local_moving",
    label: "Local moving",
    minPayloadLb: 400,
    maxPayloadLb: 10000,
    minVolumeCuFt: 150,
    minLengthIn: 72,
  },
  {
    id: "construction",
    label: "Construction materials",
    minPayloadLb: 500,
    maxPayloadLb: 20000,
    minVolumeCuFt: 50,
    minLengthIn: 96,
  },
];

export function emptyVehicleCapacity(partial = {}) {
  return {
    v: VEHICLE_CAPACITY_SCHEMA_VERSION,
    unitSystem: partial.unitSystem || "imperial",
    identity: {
      vehicleType: "",
      year: null,
      make: "",
      model: "",
      trim: "",
      cargoConfiguration: "",
      seats: null,
      driveType: "",
      ...(partial.identity || {}),
    },
    dimensions: {
      cargoLengthIn: null,
      cargoWidthIn: null,
      cargoHeightIn: null,
      cargoVolumeCuFt: null,
      doorOpeningWidthIn: null,
      doorOpeningHeightIn: null,
      bedLengthIn: null,
      trailerLengthIn: null,
      ...(partial.dimensions || {}),
    },
    weight: {
      maxPayloadLb: null,
      recommendedWorkingPayloadLb: null,
      tongueWeightLb: null,
      maxTowRatingLb: null,
      gvwrLb: null,
      ...(partial.weight || {}),
    },
    // Reserved for future expansion — keep keys stable
    photos: Array.isArray(partial.photos) ? partial.photos : [],
    vin: partial.vin ?? null,
    trailers: Array.isArray(partial.trailers) ? partial.trailers : [],
    equipment: Array.isArray(partial.equipment) ? partial.equipment : [],
    hazmatCapable: Boolean(partial.hazmatCapable),
    verificationStatus: partial.verificationStatus ?? null,
  };
}

function toNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function inchesFromDisplay(value, unitSystem, kind = "length") {
  const n = toNum(value);
  if (n == null) return null;
  if (unitSystem === "metric") {
    // kind length: user enters cm for short dims, or meters for long — we use cm for all metric form fields
    return Math.round(n / 2.54 * 10) / 10;
  }
  // imperial form: feet for long cargo fields when kind==='feet', else inches
  if (kind === "feet") return Math.round(n * 12 * 10) / 10;
  return Math.round(n * 10) / 10;
}

export function displayFromInches(inches, unitSystem, kind = "length") {
  const n = toNum(inches);
  if (n == null) return "";
  if (unitSystem === "metric") {
    return String(Math.round(n * 2.54 * 10) / 10); // cm
  }
  if (kind === "feet") return String(Math.round((n / 12) * 100) / 100);
  return String(Math.round(n * 10) / 10);
}

export function lbFromDisplay(value, unitSystem) {
  const n = toNum(value);
  if (n == null) return null;
  if (unitSystem === "metric") return Math.round(n * 2.20462 * 10) / 10; // kg → lb
  return Math.round(n * 10) / 10;
}

export function displayFromLb(lb, unitSystem) {
  const n = toNum(lb);
  if (n == null) return "";
  if (unitSystem === "metric") return String(Math.round((n / 2.20462) * 10) / 10);
  return String(Math.round(n * 10) / 10);
}

export function computeVolumeCuFt({ cargoLengthIn, cargoWidthIn, cargoHeightIn }) {
  const L = toNum(cargoLengthIn);
  const W = toNum(cargoWidthIn);
  const H = toNum(cargoHeightIn);
  if (L == null || W == null || H == null) return null;
  if (L <= 0 || W <= 0 || H <= 0) return null;
  return Math.round(((L * W * H) / 1728) * 10) / 10;
}

/**
 * Validate driver-entered capacity. Returns { ok, errors[], value }.
 */
export function validateVehicleCapacity(raw) {
  const errors = [];
  const base = emptyVehicleCapacity(typeof raw === "object" && raw ? raw : {});
  const dim = base.dimensions;
  const wt = base.weight;
  const id = base.identity;

  const year = toNum(id.year);
  if (year != null && (year < 1950 || year > new Date().getFullYear() + 1)) {
    errors.push("Year looks invalid.");
  }
  id.year = year;

  const seats = toNum(id.seats);
  if (seats != null && (seats < 1 || seats > 60)) errors.push("Seats must be between 1 and 60.");
  id.seats = seats;

  const dimKeys = [
    "cargoLengthIn",
    "cargoWidthIn",
    "cargoHeightIn",
    "doorOpeningWidthIn",
    "doorOpeningHeightIn",
    "bedLengthIn",
    "trailerLengthIn",
  ];
  for (const key of dimKeys) {
    const n = toNum(dim[key]);
    if (n != null && n < 0) errors.push("Dimensions cannot be negative.");
    if (n != null && n > 1200) errors.push("A dimension looks unrealistically large.");
    dim[key] = n;
  }

  let volume = toNum(dim.cargoVolumeCuFt);
  if (volume != null && volume < 0) errors.push("Cargo volume cannot be negative.");
  const computed = computeVolumeCuFt(dim);
  if (volume == null && computed != null) volume = computed;
  if (volume != null && volume > 5000) errors.push("Cargo volume looks unrealistically large.");
  dim.cargoVolumeCuFt = volume;

  const weightKeys = [
    "maxPayloadLb",
    "recommendedWorkingPayloadLb",
    "tongueWeightLb",
    "maxTowRatingLb",
    "gvwrLb",
  ];
  for (const key of weightKeys) {
    const n = toNum(wt[key]);
    if (n != null && n < 0) errors.push("Weight values cannot be negative.");
    if (n != null && n > 200000) errors.push("A weight value looks unrealistically large.");
    wt[key] = n;
  }

  if (
    wt.maxPayloadLb != null &&
    wt.recommendedWorkingPayloadLb != null &&
    wt.recommendedWorkingPayloadLb > wt.maxPayloadLb
  ) {
    errors.push("Recommended working payload should not exceed maximum payload.");
  }

  if (
    wt.maxPayloadLb != null &&
    wt.gvwrLb != null &&
    wt.maxPayloadLb > wt.gvwrLb
  ) {
    errors.push("Maximum payload should not exceed GVWR.");
  }

  const value = {
    ...base,
    v: VEHICLE_CAPACITY_SCHEMA_VERSION,
    identity: {
      ...id,
      vehicleType: String(id.vehicleType || "").trim().slice(0, 80),
      make: String(id.make || "").trim().slice(0, 80),
      model: String(id.model || "").trim().slice(0, 80),
      trim: String(id.trim || "").trim().slice(0, 80),
      cargoConfiguration: String(id.cargoConfiguration || "").trim().slice(0, 40),
      driveType: String(id.driveType || "").trim().slice(0, 10),
    },
    dimensions: dim,
    weight: wt,
  };

  return { ok: errors.length === 0, errors: [...new Set(errors)], value };
}

export function normalizeVehicleCapacity(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyVehicleCapacity();
  const { value } = validateVehicleCapacity(raw);
  return value;
}

export function hasCapacityData(cap) {
  const c = normalizeVehicleCapacity(cap);
  const d = c.dimensions;
  const w = c.weight;
  const i = c.identity;
  return Boolean(
    i.make ||
      i.model ||
      i.year ||
      d.cargoLengthIn ||
      d.cargoWidthIn ||
      d.cargoHeightIn ||
      d.cargoVolumeCuFt ||
      d.bedLengthIn ||
      w.maxPayloadLb ||
      w.recommendedWorkingPayloadLb
  );
}

function orientFits(box, space) {
  const dims = [box.L, box.W, box.H].sort((a, b) => b - a);
  const spaceSorted = [space.L, space.W, space.H].sort((a, b) => b - a);
  return dims[0] <= spaceSorted[0] && dims[1] <= spaceSorted[1] && dims[2] <= spaceSorted[2];
}

/**
 * Estimate which catalog items may fit. All results are estimates.
 */
export function estimateWhatFits(capacity) {
  const c = normalizeVehicleCapacity(capacity);
  const L = c.dimensions.cargoLengthIn ?? c.dimensions.bedLengthIn;
  const W = c.dimensions.cargoWidthIn;
  const H = c.dimensions.cargoHeightIn;
  const payload =
    c.weight.recommendedWorkingPayloadLb ?? c.weight.maxPayloadLb ?? null;

  if (L == null || W == null || H == null) {
    return {
      ready: false,
      fits: [],
      mayFit: [],
      doesNotFit: [],
      message: "Enter cargo length, width, and height to see estimate suggestions.",
    };
  }

  const space = { L, W, H };
  const fits = [];
  const mayFit = [];
  const doesNotFit = [];

  for (const item of FIT_CATALOG) {
    const dimOk = orientFits(item, space);
    const weightOk = payload == null ? null : item.weightLb <= payload;
    if (dimOk && weightOk !== false) {
      fits.push({
        id: item.id,
        label: item.label,
        category: item.category,
        estimate: true,
        note:
          weightOk == null
            ? "Fits by size estimate — add payload for weight check"
            : "Fits by size & payload estimate",
      });
    } else if (dimOk && weightOk === false) {
      mayFit.push({
        id: item.id,
        label: item.label,
        category: item.category,
        estimate: true,
        note: "May fit by size, but over stated working/max payload",
      });
    } else {
      doesNotFit.push({
        id: item.id,
        label: item.label,
        category: item.category,
        estimate: true,
        note: "Exceeds cargo dimensions (estimate)",
      });
    }
  }

  return {
    ready: true,
    fits,
    mayFit,
    doesNotFit,
    message: "Suggestions are estimates only — measure your load and respect payload limits.",
  };
}

/**
 * Recommend job types that do not exceed stated limits.
 */
export function recommendJobTypes(capacity) {
  const c = normalizeVehicleCapacity(capacity);
  const payload = c.weight.recommendedWorkingPayloadLb ?? c.weight.maxPayloadLb;
  const volume = c.dimensions.cargoVolumeCuFt ?? computeVolumeCuFt(c.dimensions);
  const length = c.dimensions.cargoLengthIn ?? c.dimensions.bedLengthIn;

  if (payload == null && volume == null && length == null) {
    return {
      ready: false,
      suitable: [],
      unsuitable: [],
      message: "Add payload or cargo size to see job-type suggestions.",
    };
  }

  const suitable = [];
  const unsuitable = [];

  for (const job of JOB_TYPES) {
    const reasons = [];
    if (payload != null && payload < job.minPayloadLb) {
      reasons.push("Payload below typical need for this job type");
    }
    if (payload != null && payload > job.maxPayloadLb * 1.5 && job.id === "courier") {
      // large trucks still can do courier — don't block
    }
    if (volume != null && volume < job.minVolumeCuFt) {
      reasons.push("Cargo volume may be tight for this job type");
    }
    if (length != null && length < job.minLengthIn) {
      reasons.push("Cargo length may be short for this job type");
    }

    // Hard block: never recommend when payload is below minimum for that job
    const hardFail = payload != null && payload < job.minPayloadLb;
    if (hardFail || reasons.length >= 2) {
      unsuitable.push({ id: job.id, label: job.label, reasons, estimate: true });
    } else if (reasons.length === 0) {
      suitable.push({
        id: job.id,
        label: job.label,
        estimate: true,
        note: "Within your stated capacity (estimate)",
      });
    } else {
      suitable.push({
        id: job.id,
        label: job.label,
        estimate: true,
        note: reasons[0] + " — still possible for smaller loads",
        caution: true,
      });
    }
  }

  return {
    ready: true,
    suitable,
    unsuitable,
    message:
      "Job suggestions are estimates from your entered limits. Never exceed your payload or towing ratings.",
  };
}

export function formatDimInches(inches, unitSystem = "imperial") {
  const n = toNum(inches);
  if (n == null) return "—";
  if (unitSystem === "metric") {
    const cm = Math.round(n * 2.54);
    return `${cm} cm`;
  }
  const ft = Math.floor(n / 12);
  const inch = Math.round(n % 12);
  if (ft <= 0) return `${inch}"`;
  return `${ft}' ${inch}"`;
}

export function formatWeightLb(lb, unitSystem = "imperial") {
  const n = toNum(lb);
  if (n == null) return "—";
  if (unitSystem === "metric") {
    return `${Math.round(n / 2.20462)} kg`;
  }
  return `${Math.round(n).toLocaleString()} lb`;
}

export const FIELD_HELP = {
  cargoLength: "Inside length of the cargo area (front to back).",
  cargoWidth: "Inside width of the cargo area (side to side).",
  cargoHeight: "Inside height of the cargo area (floor to roof).",
  cargoVolume: "Total cargo space. Auto-fills from L×W×H when possible — you can override.",
  doorWidth: "Width of the rear or side opening you load through.",
  doorHeight: "Height of the rear or side opening you load through.",
  bedLength: "Pickup bed length (inside).",
  trailerLength: "Trailer deck or box length, if you tow.",
  maxPayload: "Most weight your vehicle can safely carry (cargo + passengers over curb).",
  recommendedPayload: "Comfortable working load — often lower than max for everyday hauls.",
  tongueWeight: "Downward force on the hitch when towing (if applicable).",
  towRating: "Maximum trailer weight you are willing to tow with this setup.",
  gvwr: "Gross Vehicle Weight Rating from the door sticker — informational only.",
  seats: "Total seating positions including driver.",
  driveType: "How power reaches the wheels (optional).",
  cargoConfig: "How cargo is carried (enclosed, open bed, flatbed, etc.).",
};

/** Sync summary fields onto legacy driver profile columns. */
export function capacityToLegacyVehicleFields(capacity) {
  const c = normalizeVehicleCapacity(capacity);
  const lengthIn = c.dimensions.cargoLengthIn ?? c.dimensions.bedLengthIn;
  return {
    vehicleType: c.identity.vehicleType || undefined,
    vehicleYear: c.identity.year || undefined,
    vehicleMake: c.identity.make || undefined,
    vehicleModel: c.identity.model || undefined,
    vehicleCapacityLbs: c.weight.maxPayloadLb ?? c.weight.recommendedWorkingPayloadLb ?? undefined,
    vehicleLengthFt: lengthIn != null ? Math.round((lengthIn / 12) * 10) / 10 : undefined,
  };
}
