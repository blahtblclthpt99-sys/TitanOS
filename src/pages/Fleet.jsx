import React, { useState } from "react";
import { motion } from "framer-motion";
import { Truck, Fuel, Wrench, MapPin, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import NativeSelect from "@/components/shared/NativeSelect";
import PageHeader from "@/components/shared/PageHeader";

const vehicles = [
  { id: "1", name: "Van #1 – Ford Transit", plate: "ABC-1234", status: "active", mileage: 42800, fuelLevel: 72, nextService: "2026-07-15", driver: "Marcus R.", location: "En Route - 3rd Ave" },
  { id: "2", name: "Truck #2 – Chevy 2500", plate: "XYZ-5678", status: "service", mileage: 78300, fuelLevel: 45, nextService: "2026-06-30", driver: "Unassigned", location: "Service Center" },
  { id: "3", name: "Van #3 – Mercedes Sprinter", plate: "DEF-9012", status: "active", mileage: 19500, fuelLevel: 91, nextService: "2026-08-20", driver: "Jamie L.", location: "Northside District" },
];

const statusMap = {
  active: { label: "Active", color: "bg-titan-green/20 text-titan-green", icon: CheckCircle },
  service: { label: "In Service", color: "bg-titan-amber/20 text-titan-amber", icon: Wrench },
  idle: { label: "Idle", color: "bg-white/10 text-white/50", icon: Clock },
};

function FuelBar({ level }) {
  const color = level > 50 ? "bg-titan-green" : level > 25 ? "bg-titan-amber" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <Fuel className="w-3 h-3 text-white/30" />
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-white/40 w-8">{level}%</span>
    </div>
  );
}

export default function Fleet() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Fleet" subtitle={`${vehicles.length} vehicles`} onAdd={() => setShowAdd(true)} addLabel="Add Vehicle" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-titan-green">2</p>
          <p className="text-xs text-white/40 mt-1">Active Vehicles</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-titan-amber">1</p>
          <p className="text-xs text-white/40 mt-1">In Service</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-red-400">1</p>
          <p className="text-xs text-white/40 mt-1">Service Due Soon</p>
        </div>
      </div>

      <div className="space-y-3">
        {vehicles.map((v, i) => {
          const s = statusMap[v.status] || statusMap.idle;
          const StatusIcon = s.icon;
          const daysUntilService = Math.ceil((new Date(v.nextService) - new Date()) / (1000 * 60 * 60 * 24));
          return (
            <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-5 glass-hover transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-titan-cyan" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{v.name}</p>
                    <p className="text-xs text-white/30">{v.plate} · {v.mileage.toLocaleString()} mi</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${s.color}`}>
                  <StatusIcon className="w-3 h-3" />{s.label}
                </span>
              </div>
              <div className="space-y-2">
                <FuelBar level={v.fuelLevel} />
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.location}</span>
                  <span className={`flex items-center gap-1 ${daysUntilService <= 7 ? "text-titan-amber" : ""}`}>
                    {daysUntilService <= 7 && <AlertCircle className="w-3 h-3" />}
                    Service in {daysUntilService}d
                  </span>
                </div>
                <div className="text-xs text-white/30">Driver: {v.driver}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-titan-surface1 border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white">Add Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-white/50 text-xs">Vehicle Name</Label>
              <Input placeholder="e.g. Van #4 – Ford Transit" className="bg-titan-surface2 border-white/5 text-white rounded-xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/50 text-xs">License Plate</Label>
                <Input placeholder="ABC-1234" className="bg-titan-surface2 border-white/5 text-white rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-white/50 text-xs">Status</Label>
                <NativeSelect
                  value="active"
                  onValueChange={() => {}}
                  placeholder="Status"
                  options={[{value:"active",label:"Active"},{value:"service",label:"In Service"},{value:"idle",label:"Idle"}]}
                  className="mt-1"
                />
              </div>
            </div>
            <Button onClick={() => setShowAdd(false)} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11">Add Vehicle</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}