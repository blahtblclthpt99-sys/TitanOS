import React, { useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import DeleteButton from "@/components/shared/DeleteButton";

const EMPTY = { name: "", role: "technician", phone: "", email: "", hourly_rate: "", status: "active" };

export default function Employees() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      setRows(await api.entities.Employee.list("-created_date", 100));
    } catch {
      setRows([]);
    }
  };
  useEffect(() => {
    if (user?.id) load();
  }, [user?.id]);

  const add = async (event) => {
    event.preventDefault();
    if (!form.name) return;
    setAdding(true);
    try {
      const row = await api.entities.Employee.create({
        ...form,
        hourly_rate: Number(form.hourly_rate || 0),
        created_by_id: user.id,
      });
      setRows((current) => [row, ...current]);
      setForm(EMPTY);
    } finally {
      setAdding(false);
    }
  };

  const clock = async (row) => {
    const patch = {
      is_clocked_in: !row.is_clocked_in,
      current_location: !row.is_clocked_in ? `Checked in ${new Date().toLocaleTimeString()}` : "",
    };
    const saved = await api.entities.Employee.update(row.id, patch);
    setRows((current) => current.map((item) => (item.id === row.id ? saved : item)));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader title="Employees" subtitle="Manage your field team" />
      <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-5">
        <form onSubmit={add} className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex gap-2">
            <UserPlus className="w-5 h-5 text-titan-cyan" />Add employee
          </h2>
          {["name", "phone", "email", "hourly_rate"].map((key) => (
            <Input
              key={key}
              required={key === "name"}
              placeholder={key.replace("_", " ")}
              type={key === "hourly_rate" ? "number" : "text"}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="bg-muted border-border text-foreground"
            />
          ))}
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-xl p-2 bg-muted border border-border text-foreground"
          >
            <option>technician</option>
            <option>manager</option>
            <option>owner</option>
          </select>
          <Button disabled={adding} className="w-full bg-titan-cyan text-black">
            {adding ? "Saving…" : "Add employee"}
          </Button>
        </form>
        <section className="space-y-3">
          {rows.length ? (
            rows.map((row) => (
              <article key={row.id} className="glass rounded-2xl p-4 flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{row.name}</p>
                  <p className="text-sm text-foreground/45 capitalize">
                    {row.role} · {row.phone || row.email || "No contact"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${Number(row.hourly_rate || 0)}/hr · {row.status}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={() => clock(row)} variant="outline" className="border-border text-foreground">
                    {row.is_clocked_in ? "Clock out" : "Clock in"}
                  </Button>
                  <DeleteButton
                    label={row.name}
                    onDelete={async () => {
                      await api.entities.Employee.delete(row.id);
                      setRows((prev) => prev.filter((item) => item.id !== row.id));
                    }}
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
              <Users className="mx-auto mb-2" />No employees yet
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
