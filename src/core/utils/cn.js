import clsx from 'clsx';

// Thin wrapper so call sites read `cn(...)` instead of `clsx(...)`.
export function cn(...inputs) {
  return clsx(...inputs);
}
