// Matches the .btn / .btn.primary look from corrected_design.pdf exactly.
// variant: "primary" (brass, main CTA), "default" (outline), or "dark" (ink,
// used on the employer side — e.g. header actions on a dark bar).
export default function Button({ variant = "default", className = "", children, ...props }) {
  const base = "rounded-md text-sm font-medium px-4 py-2.5 cursor-pointer transition-colors border";
  const styles =
    variant === "primary"
      ? "bg-brass border-brass text-ink font-semibold hover:bg-brass-dark hover:text-white"
      : variant === "dark"
      ? "bg-ink border-ink text-white font-semibold hover:bg-ink-700"
      : "bg-surface border-line text-ink hover:bg-line/40";

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
