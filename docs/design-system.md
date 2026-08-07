# Design System

Every color resolves through a CSS variable defined in `src/index.css`
(`:root` for light, `.dark` for dark) and consumed in `tailwind.config.js`
as `rgb(var(--color-x) / <alpha-value>)` — so `ThemeContext` toggling the
`dark` class on `<html>` re-themes the whole app at once; no component
branches on theme itself. `darkMode: 'class'`, default theme is light,
persisted to `localStorage`.

## Colors

| Token | Light | Dark |
|---|---|---|
| `bg` | `255 255 255` (#FFFFFF) | `13 13 13` (#0D0D0D) |
| `surface` | `248 248 247` | `30 30 30` |
| `surface-subtle` | `243 243 241` | `36 36 36` |
| `card` | `255 255 255` | `24 24 24` |
| `border` | `232 232 229` | `42 42 42` |
| `border-strong` | `212 212 207` | `64 64 64` |
| `ink` (primary text) | `26 26 26` | `255 255 255` |
| `ink-secondary` | `107 107 107` | `217 217 217` |
| `ink-muted` | `155 155 155` | `130 130 130` |
| `sidebar` | `250 250 249` | `18 18 18` |
| `accent` (primary action) | `26 26 26` | `196 164 132` (warm gold) |
| `accent-hover` | `51 51 51` | `176 141 87` |
| `accent-ink` (text on accent) | `255 255 255` | `26 26 26` |

Status colors — same hue in both themes, only the tinted backgrounds
differ (light uses literal pale tints, dark uses muted low-luminance
tints since it isn't just an alpha blend):

| Status | Foreground (both modes) | Light bg | Dark bg |
|---|---|---|---|
| Success / In Hall | `34 197 94` (#22C55E) | `240 253 244` (#F0FDF4) | `20 41 28` |
| Warning / Issued | `245 158 11` (#F59E0B) | `255 251 235` (#FFFBEB) | `42 34 20` |
| Info / In Transit | `59 130 246` (#3B82F6) | `239 246 255` (#EFF6FF) | `20 30 46` |
| Error / Expired | `239 68 68` (#EF4444) | `254 242 242` (#FEF2F2) | `42 24 24` |

These map onto the semantic `status-in-hall-*` / `status-checked-out-*` /
`status-in-transit-*` / `status-expired-*` Tailwind classes used
throughout (`StatusBadge`, `PanelStatusBadge`, `ValidityBadge` in
`core/components/Badge.jsx`).

## Typography

Font: **Inter** (weights 400/500/600 loaded; 700 available for the login
heading and stat-card numbers specifically). Fallback: `ui-sans-serif,
system-ui, sans-serif`. BT codes and other identifiers render in
monospace (`font-mono` utility, plain system mono stack — no custom
monospace font loaded).

| Token | Size / line-height |
|---|---|
| `caption` | 12px / 16px |
| `body` | 14px / 20px |
| `body-lg` | 16px / 24px |
| `heading` | 20px / 28px |
| `display` | 28px / 34px |

Font weights registered: `normal` 400, `medium` 500, `semibold` 600.

## Spacing

Tailwind's default scale, used on the 8px grid (`2`→8px, `4`→16px,
`6`→24px, `8`→32px, `10`→40px, `12`→48px) — no custom spacing scale
defined, the constraint is convention (stick to values landing on 8px),
not enforced in config.

## Radius, shadow, motion

| Token | Value |
|---|---|
| `rounded-card` | 10px |
| `rounded-control` | 7px (buttons, inputs) |
| `rounded-modal` | 12px |
| `rounded-pill` | 100px (badges, pill tabs) |
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.04)` |
| `shadow-lift` | `0 4px 12px rgba(0,0,0,0.08)` (card hover) |
| `shadow-dropdown` | `0 12px 32px rgba(0,0,0,0.14)` |
| Default transition duration | 150ms |

Custom keyframes (`@layer utilities` in `index.css`):
- `fadeIn` — plain opacity fade.
- `pageIn` — translateY(8px)→0 + fade, drives per-route page transitions
  (`app/Layout.jsx`, remounts on `location.pathname` change).
- `slideIn` — translateX(24px)→0.
- `toastIn` — translateY(12px)→0 + fade.
- `grainDrift` (18s linear infinite) — drives `.login-grain`, an
  inline-SVG turbulence-noise texture on the Login screen's dark brand
  panel.
- `shimmer` — drives `.skeleton::after`'s loading shimmer sweep.
- `pulseSlow` (2.4s) / `pulseFast` (1.2s) — `ValidityBadge`'s "expiring
  within 30 days" vs "expiring within 15 days" pulse intensity.

Framer Motion is used for interactive/JS-driven motion beyond what these
CSS keyframes cover (Sidebar collapse width spring, dropdown/menu
open-close springs, stat-card count-up via `useCountUp`, list stagger).

## Component patterns

- **Card** (`core/components/Card.jsx`): `bg-card`, `rounded-card`,
  `shadow-card`; `bordered` prop (default true) adds `border border-border`
  — stat cards pass `bordered={false}` and rely on shadow alone for
  definition.
- **Button** (`core/components/Button.jsx`): variants `primary`
  (`bg-accent text-accent-ink`), `secondary` (`bg-card border-ink
  text-ink`), `ghost`, `danger` (`text-error border-error/25`), `success`,
  `warning`. Heights: `md` 36px (`h-9`), `sm` 32px (`h-8`) — desktop-only,
  no separate mobile tap-target sizing.
- **Input/Select/Textarea** (`core/components/Input.jsx`): 36px height,
  `rounded-control`, `border-border`, focus ring `ring-[1.5px] ring-ink`.
- **Modal** (`core/components/Modal.jsx`): centered dialog, default
  max-width 480px (individual callers override, e.g. issue modals use
  520px), `rounded-modal`, overlay `bg-black/40 backdrop-blur-sm`, spring
  scale+fade open/close (no mobile bottom-sheet variant).
- **Drawer** (`core/components/Drawer.jsx`): fixed 480px right panel,
  slides in from the right, same overlay treatment as Modal.
- **Table** (`core/components/Table.jsx`): thin row dividers, row hover
  `bg-sidebar` (#FAFAF9 in light), 12px uppercase header — no zebra
  striping.
- **Badges** (`core/components/Badge.jsx`): pill-shaped
  (`rounded-pill`), 12px font, soft tinted background per status; role
  badges and validity badges follow the same base style.
- **StatCard** (`core/components/StatCard.jsx`): borderless, icon in a
  soft tone-tinted circle, `useCountUp()`-animated number, hover lift
  (`hover:-translate-y-0.5 hover:shadow-lift`), optional `onClick` to
  navigate to a filtered list.
- **Toast** (`core/context/ToastContext.jsx` + `core/components/Toast.jsx`):
  bottom-right, 3s auto-dismiss, `.success()`/`.error()`/`.info()`.
- **Skeleton loaders** (`core/components/Skeleton.jsx`): `TableSkeleton`,
  `StatCardSkeleton`, `CardListSkeleton` — never a bare spinner for data
  fetches.
- **PillTabs** (`core/components/PillTabs.jsx`): segmented status filter
  used on every sample/panel list, active pill uses `bg-accent
  text-accent-ink`.

## Iconography

A hand-rolled inline SVG icon set (`core/components/icons.jsx`, ~20
icons) is the primary icon system app-wide, chosen deliberately over an
external library for zero extra dependency weight. `lucide-react` is
installed and used specifically for the theme toggle's sun/moon icons and
the login password show/hide eye icon — new icon needs should default to
the existing hand-rolled set unless there's a specific reason to reach
for lucide.
