/**
 * Accessible settings switch row — 44px touch target, role=switch.
 */
export default function ToggleRow({ checked, label, description, onChange, className = "" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      onClick={() => onChange?.(!checked)}
      className={`w-full flex min-h-[44px] items-center gap-3 text-left rounded-md p-3 hover:bg-muted/60 transition-colors focus-ring ${className}`}
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
        ) : null}
      </span>
      <span
        className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
        aria-hidden="true"
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </span>
    </button>
  );
}
