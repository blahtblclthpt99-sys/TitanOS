import React, { useState } from "react";
import { AlertTriangle, PackagePlus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import DeleteButton from "@/components/shared/DeleteButton";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import {
  createInventoryItem,
  deleteInventoryItem,
  isLowStock,
  listInventory,
  updateInventoryItem,
} from "@/lib/inventoryApi";

const EMPTY = { name: "", quantity: "", reorder_at: "5", unit: "ea", category: "supplies", unit_cost: "" };

export default function Inventory() {
  const { user } = useAuth();
  const { data: items = [], setData: setItems, loading, error, reload } = useSafeAsync(
    () => listInventory(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (saving || !form.name) return;
    setSaving(true);
    try {
      const item = await createInventoryItem(user, form);
      setItems((current) => [item, ...current]);
      setForm(EMPTY);
      toast({ title: "Item added" });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't add item", description: error?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const adjust = async (item, quantity) => {
    try {
      const saved = await updateInventoryItem(user.id, item.id, { quantity });
      setItems((current) => current.map((row) => (row.id === item.id ? saved : row)));
    } catch {
      toast({ variant: "destructive", title: "Couldn't update quantity" });
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading inventory" />;
  if (error) return <ErrorState title="Couldn't load inventory" onRetry={reload} />;

  const low = items.filter(isLowStock);

  return (
    <div className="page-pad max-w-6xl mx-auto">
      <PageHeader title="Inventory" subtitle={`${low.length} low-stock alert${low.length === 1 ? "" : "s"}`} />
      <div className="grid lg:grid-cols-[.75fr_1.25fr] gap-5">
        <form className="titan-surface p-5 space-y-3" onSubmit={add}>
          <h2 className="font-semibold text-foreground flex gap-2">
            <PackagePlus className="text-titan-cyan" />Add item
          </h2>
          {["name", "quantity", "reorder_at", "unit_cost"].map((key) => (
            <Input
              key={key}
              required={key === "name"}
              type={key === "name" ? "text" : "number"}
              placeholder={key.replace("_", " ")}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="bg-muted border-border text-foreground"
            />
          ))}
          <Button className="w-full" disabled={saving}>{saving ? "Saving…" : "Save item"}</Button>
        </form>
        <section className="space-y-3">
          {!items.length && (
            <EmptyState
              icon={PackagePlus}
              title="No inventory yet"
              description="Add your first supply or part to start tracking stock."
            />
          )}
          {items.map((item) => (
            <article className="titan-surface p-4 flex justify-between gap-3" key={item.id}>
              <div>
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="text-sm text-foreground/45">
                  {item.category} · ${Number(item.unit_cost || 0).toFixed(2)}/{item.unit || "ea"}
                </p>
                {isLowStock(item) && (
                  <p className="text-xs text-titan-amber flex gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" />Reorder now
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => adjust(item, Number(item.quantity) - 1)}>-</Button>
                <span className="text-foreground">{item.quantity}</span>
                <Button size="sm" onClick={() => adjust(item, Number(item.quantity) + 1)}>+</Button>
                <DeleteButton
                  label={item.name}
                  onDelete={async () => {
                    try {
                      await deleteInventoryItem(user.id, item.id);
                      setItems((prev) => prev.filter((row) => row.id !== item.id));
                      toast({ title: "Item removed" });
                    } catch {
                      toast({ variant: "destructive", title: "Couldn't remove item" });
                    }
                  }}
                />
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
