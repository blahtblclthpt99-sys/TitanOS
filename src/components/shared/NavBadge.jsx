export default function NavBadge({ count, className = "" }) {
  if (!count || count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none ${className}`}
      aria-label={`${count} notifications`}
    >
      {label}
    </span>
  );
}
