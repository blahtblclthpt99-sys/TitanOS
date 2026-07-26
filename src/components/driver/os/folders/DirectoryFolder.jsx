import React from "react";
import DriverDirectory from "@/components/driver/DriverDirectory";

export default function DirectoryFolder({ initialQuery = "" }) {
  return <DriverDirectory initialQuery={initialQuery} />;
}
