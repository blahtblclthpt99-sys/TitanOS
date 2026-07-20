import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Plus, Truck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { createEquipment, deleteEquipment, listEquipment } from "@/lib/equipmentApi";
import {
  VEHICLE_MAKES,
  modelsForMake,
  vehicleLabel,
  vehicleYearOptions,
} from "@/lib/vehicleCatalog";

const EMPTY = {
  name: "",
  make: "",
  model: "",
  year: "",
  category: "vehicle",
  status: "active",
  next_service_date: "",
  warranty_expires: "",
};

const due = (date) => date && new Date(date) <= new Date(Date.now() + 30 * 86400000);
const YEARS = vehicleYearOptions();
const fieldClass = "w-full h-10 px-3 rounded-xl bg-muted border border-border text-foreground text-sm";

export default function Fleet() {
  const { user } = useAuth();
  const { data: rows = [], setData: setRows, loading, error, reload } = useSafeAsync(
    () => listEquipment(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [form, setForm] = useState(EMPTY);

  const isVehicle = form.category === "vehicle";
  const modelOptions = modelsForMake(form.make);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "make") next.model = "";
      // Auto nickname from year/make/model when user hasn't typed a custom name
      if (["make", "model", "year"].includes(key)) {
        const auto = [next.year, next.make, next.model].filter(Boolean).join(" ");
        if (!prev.name || prev.name === [prev.year, prev.make, prev.model].filter(Boolean).join(" ")) {
          next.name = auto;
        }
      }
      return next;
    });
  };

  const add = async (e) => {
    e.preventDefault();
    if (isVehicle && (!form.make || !form.model)) return;
    if (!form.name && !(form.make && form.model)) return;
    const payload = {
      name: form.name || [form.year, form.make, form.model].filter(Boolean).join(" "),
      category: form.category,
      status: form.status,
      // DB uses brand for make
      brand: form.make || "",
      model: form.model || "",
      year: form.year ? Number(form.year) : null,
      next_service_date: form.next_service_date || null,
      warranty_expires: form.warranty_expires || null,
      // local mirror for Driver Hub labels
      make: form.make || "",
    };
    const row = await createEquipment(user, payload);
    setRows([row, ...rows]);
    setForm(EMPTY);
  };

  if (loading) return <PageLoader variant="list" label="Loading fleet" />;
  if (error) return <ErrorState title="Couldn't load fleet" onRetry={reload} />;

  return (
    <div className="page-pad max-w-6xl mx-auto">
      <PageHeader title="Fleet & equipment" subtitle={`${rows.length} assets tracked`} />
      <p className="text-sm text-muted-foreground -mt-3 mb-4">
        Add make & model for vehicles — Driver Hub uses them for fuel estimates and tax mileage.{" "}
        <Link to="/driver" className="text-titan-cyan hover:underline">
          Open Driver Hub →
        </Link>
      </p>
      <div className="grid lg:grid-cols-[.85fr_1.15fr] gap-5">
        <form className="glass rounded-2xl p-5 space-y-3" onSubmit={add}>
          <h2 className="font-semibold text-foreground flex gap-2">
            <Plus className="text-titan-cyan" />
            Add equipment
          </h2>

          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              {["vehicle", "trailer", "mower", "pressure_washer", "tool", "other"].map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {isVehicle && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Vehicle details</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Make</label>
                  <select
                    required
                    value={form.make}
                    onChange={(e) => setField("make", e.target.value)}
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="">Select make…</option>
                    {VEHICLE_MAKES.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Model</label>
                  <select
                    required
                    value={form.model}
                    onChange={(e) => setField("model", e.target.value)}
                    disabled={!form.make}
                    className={`mt-1 ${fieldClass} disabled:opacity-50`}
                  >
                    <option value="">{form.make ? "Select model…" : "Pick make first"}</option>
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Year</label>
                  <select
                    value={form.year}
                    onChange={(e) => setField("year", e.target.value)}
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="">Year (optional)</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Nickname (optional)</label>
                  <Input
                    placeholder="e.g. Work truck"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 bg-muted border-border text-foreground rounded-xl"
                  />
                </div>
              </div>
              {form.make === "Other" && (
                <Input
                  placeholder="Custom model name"
                  value={form.model === "Custom / Other" ? "" : form.model}
                  onChange={(e) => setField("model", e.target.value || "Custom / Other")}
                  className="bg-muted border-border text-foreground rounded-xl"
                />
              )}
            </div>
          )}

          {!isVehicle && (
            <Input
              required
              placeholder="Equipment name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-muted border-border text-foreground"
            />
          )}

          <Input
            type="date"
            value={form.next_service_date}
            onChange={(e) => setForm({ ...form, next_service_date: e.target.value })}
            className="bg-muted border-border text-foreground"
            aria-label="Next service date"
          />
          <Input
            type="date"
            value={form.warranty_expires}
            onChange={(e) => setForm({ ...form, warranty_expires: e.target.value })}
            className="bg-muted border-border text-foreground"
            aria-label="Warranty expires"
          />
          <Button className="w-full">
            {isVehicle ? "Save vehicle" : "Save equipment"}
          </Button>
        </form>

        <section className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground glass rounded-2xl p-5">
              No fleet yet. Add a vehicle with make & model to use it in Driver Hub.
            </p>
          )}
          {rows.map((row) => (
            <article key={row.id} className="glass rounded-2xl p-4 flex gap-3">
              <Truck className="text-titan-cyan flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{vehicleLabel(row)}</p>
                <p className="text-sm text-foreground/45 capitalize">
                  {row.category?.replace("_", " ")} · {row.status}
                  {(row.make || row.brand) && row.model
                    ? ` · ${row.make || row.brand} ${row.model}`
                    : ""}
                  {row.year ? ` · ${row.year}` : ""}
                </p>
                {(due(row.next_service_date) || due(row.warranty_expires)) && (
                  <p className="text-xs text-titan-amber flex gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    {due(row.next_service_date) ? "Service due" : "Warranty ending soon"}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await deleteEquipment(user.id, row.id);
                  setRows(rows.filter((item) => item.id !== row.id));
                }}
                className="text-foreground/45"
              >
                Remove
              </Button>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
