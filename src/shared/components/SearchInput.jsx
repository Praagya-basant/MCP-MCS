export function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={`relative ${className || ''}`}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="interactive w-full h-9 rounded-control border border-border bg-card pl-9 pr-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink"
      />
    </div>
  );
}
