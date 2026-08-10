import React from "react";
import LogbookHost from "./LogbookHost.jsx";

export default function TaxFolder({ user }) {
  return <LogbookHost user={user} mode="tax" />;
}
