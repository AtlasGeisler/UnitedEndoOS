import { cn } from "@/lib/utils";

// A synthetic patient avatar: a deterministic colored monogram from the name.
// We never store real patient photos (synthetic data only, no PHI), so the
// initials stand in for the headshot a Mac-native chart would show.
const PALETTE = [
  "#3A7D44", "#1E3A28", "#5B6B7C", "#7CB68A", "#C98A2B",
  "#4A6FA5", "#9A5BA0", "#C0432F", "#2E7D7B", "#7A6A4F",
];

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function Avatar({
  firstName,
  lastName,
  size = 40,
  className,
}: {
  firstName: string;
  lastName: string;
  size?: number;
  className?: string;
}) {
  const bg = colorFor(`${firstName} ${lastName}`);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials(firstName, lastName)}
    </span>
  );
}
