import { initials } from '@/shared/utils/formatters';

/** Small initials-circle + name, used wherever a movement's picker is listed in a table row. */
export function PickerAvatar({ name }) {
  const label = name || '—';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-accent/12 text-accent flex items-center justify-center text-[10px] font-semibold shrink-0">
        {initials(label === '—' ? '' : label)}
      </span>
      <span>{label}</span>
    </span>
  );
}
