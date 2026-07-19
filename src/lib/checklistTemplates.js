export const SERVICE_CHECKLISTS = {
  pressure_washing: ["Inspect hoses and fittings", "Protect nearby surfaces", "Test pressure setting", "Complete rinse and cleanup"],
  lawn_care: ["Inspect area for obstacles", "Mow and edge service areas", "Blow clippings from hard surfaces", "Secure gates and equipment"],
  hvac: ["Inspect filter and replace if needed", "Check thermostat operation", "Inspect electrical connections", "Document readings and recommendations"],
  general: ["Confirm scope with customer", "Inspect work area and safety risks", "Complete service work", "Clean up and confirm customer satisfaction"],
};
export function checklistForService(serviceType) {
  const key = String(serviceType || "").toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  return SERVICE_CHECKLISTS[key] || SERVICE_CHECKLISTS.general;
}
