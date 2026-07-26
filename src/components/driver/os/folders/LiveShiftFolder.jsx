import React from "react";
import DriverShiftPanel from "@/components/driver/DriverShiftPanel";
import DriverLocationPanel from "@/components/driver/DriverLocationPanel";

export default function LiveShiftFolder() {
  return (
    <div className="space-y-4">
      <DriverLocationPanel />
      <DriverShiftPanel />
    </div>
  );
}
