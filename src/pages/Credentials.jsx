import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import DeleteButton from "@/components/shared/DeleteButton";
import { createCredential, daysUntilExpiry, deleteCredential, listCredentials } from "@/lib/credentialsApi";

export default function Credentials() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");

  const load = async () => {
    if (user?.id) setItems(await listCredentials(user.id));
  };
  useEffect(() => {
    load();
  }, [user?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!title) return;
    const row = await createCredential(user, { title, expires_on: expires || null });
    setItems([...items, row]);
    setTitle("");
    setExpires("");
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Credentials" subtitle="Keep licenses, certifications, and insurance current" />
      <form onSubmit={add} className="glass rounded-2xl p-4 flex flex-wrap gap-2 mb-5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="License or certificate" className="flex-1 bg-muted border-border text-foreground" />
        <Input value={expires} onChange={(e) => setExpires(e.target.value)} type="date" className="bg-muted border-border text-foreground" />
        <Button className="bg-titan-cyan text-black">Add</Button>
      </form>
      <div className="space-y-3">
        {items.map((item) => {
          const days = daysUntilExpiry(item);
          const bad = days !== null && days < 30;
          return (
            <article className="glass rounded-2xl p-4 flex gap-3 items-start" key={item.id}>
              {bad ? <AlertTriangle className="text-titan-amber" /> : <ShieldCheck className="text-titan-cyan" />}
              <div className="flex-1">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className={`text-sm ${days < 0 ? "text-red-300" : bad ? "text-titan-amber" : "text-foreground/45"}`}>
                  {days === null
                    ? "No expiry recorded"
                    : days < 0
                      ? `Expired ${Math.abs(days)} days ago`
                      : `${days} days until expiry`}
                </p>
              </div>
              <DeleteButton
                label={item.title}
                onDelete={async () => {
                  await deleteCredential(user.id, item.id);
                  setItems((prev) => prev.filter((row) => row.id !== item.id));
                }}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
