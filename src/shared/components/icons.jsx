// Minimal inline icon set (24x24 viewBox, stroke-based) so the app has no
// external icon package dependency. Each icon accepts standard SVG props.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

export function IconGrid(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.2c2.5.4 4.5 2.5 4.5 5.3" />
    </svg>
  );
}

export function IconBuilding(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 7.5h1.5M13.5 7.5H15M9 11.5h1.5M13.5 11.5H15M9 15.5h1.5M13.5 15.5H15" />
      <path d="M10 20.5v-3h4v3" />
    </svg>
  );
}

export function IconBox(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" />
      <path d="M3.5 8L12 12.3 20.5 8M12 12.3v8.2" />
    </svg>
  );
}

export function IconMove(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </svg>
  );
}

export function IconBell(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 1112 0c0 3.6 1 5.2 1.5 6H4.5C5 14.2 6 12.6 6 9z" />
      <path d="M9.5 19a2.5 2.5 0 005 0" />
    </svg>
  );
}

export function IconHistory(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconDownload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" />
      <path d="M4.5 17.5V19a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-1.5" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4.5H6A1.5 1.5 0 004.5 6v12A1.5 1.5 0 006 19.5h3" />
      <path d="M14.5 8.5l4 3.5-4 3.5M18.2 12H9.5" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconLayers(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l8.5 4.5-8.5 4.5-8.5-4.5L12 3.5z" />
      <path d="M3.5 13l8.5 4.5 8.5-4.5" />
      <path d="M3.5 17l8.5 4.5 8.5-4.5" />
    </svg>
  );
}

export function IconMessage(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4v-11z" />
    </svg>
  );
}

export function IconAlert(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0114.5 5v2" />
      <path d="M6.5 7l.9 12.1a2 2 0 002 1.9h5.2a2 2 0 002-1.9L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
