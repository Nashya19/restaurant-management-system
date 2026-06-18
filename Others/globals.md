# globals.css — Full Reference

## How this file is structured

Two themes live in one file. `:root` is the customer-facing light theme. `.dark` is the staff/admin dark theme. They share variable names but different values. Components use the variable names and automatically adapt based on which theme is active.

The rule: **staff and admin pages always render in dark mode. Customer QR pages always render in light mode.** No toggle for the user — it is set programmatically per route.

---

## Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');
```

| Font | Role | Weights |
|------|------|---------|
| DM Sans | All UI text, headings, labels | 400, 500, 600 |
| JetBrains Mono | Prices, PINs, order numbers, times, counts | 400 |

**Rule:** Any value that is a number the user needs to read accurately — price, PIN, order ID, wait time, quantity — uses JetBrains Mono. Everything else is DM Sans.

---

## Colour Tokens

### `:root` — Customer / Public (Light, Terracotta accent)

| Variable | Value | Usage |
|----------|-------|-------|
| `--background` | `#FAFAF8` | Page background |
| `--foreground` | `#1A1714` | Body text |
| `--surface` | `#F0EDE8` | Cards, panels |
| `--surface-raised` | `#E8E4DE` | Hover states, nested panels, inputs |
| `--border` | `#D4D0CB` | All dividers and outlines |
| `--primary` | `#1A1714` | Primary text |
| `--accent` | `#C4622D` | Terracotta — primary CTA, active states |
| `--accent-rgb` | `196, 98, 45` | For rgba() use |
| `--accent-dim` | `#8A3F1E` | Terracotta on light surfaces, secondary use |
| `--text-primary` | `#1A1714` | Headings, labels |
| `--text-secondary` | `#6A6460` | Subtitles, metadata |
| `--text-muted` | `#A09890` | Disabled, timestamps |
| `--success` | `#4A7C59` | Delivered, approved, ready |
| `--success-bg` | `#EFF7F2` | Success badge background |
| `--success-border` | `#B8D4C2` | Success badge border |
| `--warning` | `#B8860B` | Preparing, pending |
| `--warning-bg` | `#FDF8EC` | Warning badge background |
| `--warning-border` | `#E8D08A` | Warning badge border |
| `--destructive` | `#8B3A3A` | Cancel, delete, error |
| `--destructive-bg` | `#FDF2F2` | Destructive badge background |
| `--destructive-border` | `#D4AAAA` | Destructive badge border |
| `--info` | `#3A6A8B` | Info states |
| `--info-bg` | `#F0F5FA` | Info badge background |
| `--info-border` | `#AACCE0` | Info badge border |
| `--radius` | `0.25rem` | Default border radius (4px) |
| `--radius-md` | `0.375rem` | Card radius (6px) |
| `--radius-lg` | `0.5rem` | Modal radius (8px) |

---

### `.dark` — Staff / Admin (Dark, Amber accent)

| Variable | Value | Usage |
|----------|-------|-------|
| `--background` | `#0F0F0F` | Page background |
| `--foreground` | `#F0EDE8` | Body text |
| `--surface` | `#1A1A1A` | Cards, sidebars, panels |
| `--surface-raised` | `#242424` | Hover states, nested panels, inputs |
| `--border` | `#2E2E2E` | All dividers and outlines |
| `--primary` | `#F0EDE8` | Primary text |
| `--accent` | `#D4862A` | Amber — primary CTA, active states |
| `--accent-rgb` | `212, 134, 42` | For rgba() use |
| `--accent-dim` | `#7A4D18` | Amber on dark surfaces, shift blocks |
| `--text-primary` | `#F0EDE8` | Headings, labels |
| `--text-secondary` | `#8A8480` | Subtitles, metadata |
| `--text-muted` | `#4A4744` | Disabled, timestamps |
| `--success` | `#4A9B6A` | Delivered, approved, ready |
| `--success-bg` | `#0F2318` | Success badge background |
| `--success-border` | `#2A5C3A` | Success badge border |
| `--warning` | `#D4862A` | Preparing, pending |
| `--warning-bg` | `#2A1F0A` | Warning badge background |
| `--warning-border` | `#5A3A10` | Warning badge border |
| `--destructive` | `#C45A5A` | Cancel, delete, error |
| `--destructive-bg` | `#2A1010` | Destructive badge background |
| `--destructive-border` | `#5A2020` | Destructive badge border |
| `--info` | `#6A9BBF` | Info states |
| `--info-bg` | `#0F1E2A` | Info badge background |
| `--info-border` | `#1E4060` | Info badge border |

---

## Body

```css
body {
  color: var(--foreground);
  background-color: var(--background);
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-y: scroll;
}
```

**Dark side only** — very subtle amber ambient glow at corners, fixed attachment:
```css
.dark body {
  background-image:
    radial-gradient(ellipse at 0% 0%, rgba(212, 134, 42, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, rgba(212, 134, 42, 0.03) 0%, transparent 50%);
  background-attachment: fixed;
}
```

**Light side** — no background effects. Clean.

---

## Theme Transition

Applied to `<html>` when switching themes programmatically:

```css
html.theme-transition,
html.theme-transition *,
html.theme-transition *:before,
html.theme-transition *:after {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease !important;
  transition-delay: 0 !important;
}
```

---

## Typography Classes

| Class | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| `.text-display` | 28px | 600 | DM Sans | Page titles |
| `.text-heading` | 20px | 600 | DM Sans | Section headings, card titles |
| `.text-subheading` | 15px | 500 | DM Sans | Table headers, nav labels |
| `.text-body` | 14px | 400 | DM Sans | General content |
| `.text-small` | 11px | 400 | DM Sans | Metadata, timestamps |
| `.text-data` | 13px | 400 | JetBrains Mono | Prices, PINs, IDs, counts |

Headings use `letter-spacing: -0.01em`. Nothing else.

---

## Status Badges

All badges use class `.badge` as base plus a modifier. Dark mode values shown — these are hardcoded, not variable-based, because badges need consistent colour regardless of surface.

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

| Class | Background | Text | Used for |
|-------|-----------|------|----------|
| `.badge-placed` | `#1E2430` | `#6B8BBF` | Order placed |
| `.badge-preparing` | `#2A1F0A` | `#D4862A` | Order/item preparing |
| `.badge-ready` | `#0F2318` | `#4A9B6A` | Order/item ready |
| `.badge-delivered` | `#1E1E1E` | `#6A6460` | Order delivered |
| `.badge-cancelled` | `#2A1010` | `#C45A5A` | Order cancelled |
| `.badge-pending` | `#1E1E1E` | `#8A8480` | Switch request pending |
| `.badge-approved` | `#0F2318` | `#4A9B6A` | Switch request approved |
| `.badge-rejected` | `#2A1010` | `#C45A5A` | Switch request rejected |
| `.badge-inactive` | `#1A1A1A` | `#4A4744` | Table inactive |
| `.badge-open` | `#1A2410` | `#6A9B4A` | Table open |
| `.badge-locked` | `#2A1F0A` | `#D4862A` | Table locked |
| `.badge-completed` | `#0F1E2A` | `#4A7AAB` | Table completed |
| `.badge-cleared` | `#1A1A1A` | `#4A4744` | Table cleared |
| `.badge-admin` | `#2A1F0A` | `#D4862A` | Admin role |
| `.badge-staff` | `#1E1E1E` | `#8A8480` | Staff role |

Light mode overrides for customer-facing badges use terracotta-adjacent tones.

---

## Buttons

Base class `.btn` + modifier. All buttons are 40px height, 4px radius.

| Class | Background | Text | Border | Usage |
|-------|-----------|------|--------|-------|
| `.btn-primary` | `var(--accent)` | `#0F0F0F` | none | Primary CTA |
| `.btn-ghost` | transparent | `var(--text-primary)` | `var(--border)` | Secondary actions |
| `.btn-danger` | `var(--destructive-bg)` | `var(--destructive)` | `var(--destructive-border)` | Delete, cancel |
| `.btn-success` | `var(--success-bg)` | `var(--success)` | `var(--success-border)` | Confirm, approve |

Hover on `.btn-primary` — opacity 0.9. Hover on `.btn-danger` and `.btn-success` — fills to solid colour. Disabled — opacity 0.4.

---

## Cards

```css
.card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
}
```

No box shadows on the dark side. Elevation is communicated through colour steps only:
`--background` → `--surface` → `--surface-raised`

---

## Sidebar Navigation

```css
.nav-item        — default state, text-secondary
.nav-item:hover  — text-primary, surface-raised background
.nav-item.active — accent text, 2px accent left border, surface-raised background
```

Active item gets the amber left border. That is the only amber element in the sidebar.

---

## Stat Cards (Dashboard)

```css
.stat-card        — surface background, border, radius-md, 20px padding
.stat-card-label  — 11px, 500 weight, uppercase, 0.08em letter-spacing, text-secondary
.stat-card-value  — JetBrains Mono, 32px, text-primary
```

The active orders stat card gets `.border-accent-left` — 2px amber left border. Only one card gets this. The rest are identical and neutral.

---

## Wait Time Colours

Applied to the wait time value in JetBrains Mono:

| Class | Colour | Trigger |
|-------|--------|---------|
| `.wait-normal` | `var(--text-primary)` | Under 30 min |
| `.wait-amber` | `var(--accent)` | 30–45 min |
| `.wait-danger` | `var(--destructive)` | Over 45 min |

---

## Kitchen Display — New Order Flash

When a new order arrives, a 2px line at the very top of the page flashes amber twice. No toast. No modal. No sound. Just the line.

```css
.new-order-indicator {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background-color: var(--accent);
  animation: amber-flash 0.6s ease 2;
  pointer-events: none;
}

@keyframes amber-flash {
  0%   { opacity: 1; }
  50%  { opacity: 0.3; }
  100% { opacity: 1; }
}
```

Mount this component into the DOM when a new order comes in, unmount after animation completes.

---

## PIN Input (Customer)

Four separate inputs side by side. Each:

```css
.pin-input {
  width: 52px;
  height: 56px;
  text-align: center;
  font-family: JetBrains Mono;
  font-size: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  caret-color: var(--accent);
}

.pin-input:focus {
  border-color: var(--accent);
}
```

---

## Inputs (Global)

```css
input, select, textarea {
  background-color: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 14px;
  height: 40px;
  padding: 0 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

input:focus, select:focus, textarea:focus {
  border-color: var(--accent);
}
```

Price and numeric inputs automatically use JetBrains Mono via `input[type="number"]` selector.

---

## FullCalendar Overrides (Scheduling)

| Element | Value |
|---------|-------|
| Shift block background | `var(--accent-dim)` |
| Shift block border | `1px solid var(--accent)` |
| Shift block text | `var(--text-primary)` |
| Shift block hover | `rgba(accent, 0.3)` |
| Pending switch request block | dashed border |
| Grid lines | `var(--border)` |
| Column headers | `var(--surface)` background, `var(--text-primary)` text |
| Current time indicator | `2px solid var(--accent)` |
| Today column | `rgba(accent, 0.03)` tint |

---

## Scrollbars

6px width. Track transparent. Thumb uses `var(--border)`, hover uses `var(--text-muted)`. Modal scrollbar thumb uses `var(--accent)` on hover only.

---

## Global Rules Summary

1. **One accent element per screen.** Amber on admin/staff. Terracotta on customer. Never both.
2. **All numeric data in JetBrains Mono.** Prices, PINs, times, counts, IDs.
3. **Status always a badge.** Never colour alone.
4. **No box shadows on dark side.** Elevation through colour steps only.
5. **Customer pages light. Staff/Admin pages dark.** Set per route, not user-toggled.
6. **Borders over shadows everywhere.**
7. **Error states: coloured text, not coloured backgrounds.**
8. **Buttons: 40px height, 4px radius, no pills.**
9. **Transitions max 150ms** except theme switch which is 300ms.
10. **Empty states: one plain instruction line.** No illustrations, no icons, no sad copy.
