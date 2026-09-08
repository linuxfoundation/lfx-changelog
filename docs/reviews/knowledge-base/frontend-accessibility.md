<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Frontend accessibility and Angular control-flow patterns

Patterns extracted from past PR review comments on shared UI components.

## `@for` must track by a stable, unique value — not a display label

Tracking by a rendered label (`track lbl`) breaks when labels repeat or
reorder, and any index-based removal (`selectedValues()[$index]`) compounds
the bug. Track by the underlying value (or iterate the value collection
directly and derive the label by index).

- Source: PR #93, `apps/lfx-changelog/src/app/shared/components/select/select.component.html` —
  chip rendering tracked by `lbl`; fixed to `@for (value of selectedValues(); track value; ...)`.

## Icon-only interactive controls need a real `<button>` and an `aria-label`

A clickable `<i>` icon with a click handler is invisible to keyboard and
screen-reader users. Wrap it in `<button type="button">` with an
`aria-label` describing the action (e.g. "Remove {{ label }}").

- Source: PR #93, same component — chip "remove" control was a clickable
  `<i>`; fixed to a labeled `<button type="button">`.

## Never nest interactive elements (`<button>` inside `<button>`)

Nested interactive elements are invalid HTML and produce inconsistent
click/keyboard/screen-reader behavior. If a control (like a multi-select
trigger) needs child controls of its own (like per-chip remove buttons),
the outer element can't be a `<button>` — use a non-button element with
`role="combobox"`/appropriate ARIA role and `tabindex` instead, reserving
plain `<button>` for the single-select case that has no children.

- Source: PR #93, same component (follow-up round) — the multi-select
  trigger nested per-chip `<button>` elements inside the outer trigger
  `<button>`; fixed by splitting multi-select into a `<div role="combobox"
tabindex="0">` while single-select kept `<button>`.

## Don't remove a visible focus indicator without a fallback for browsers lacking the replacement

Suppressing `:focus` outline in favor of `:focus-visible` with a
`color-mix()`-based ring drops all visible focus indication in browsers or
environments without `:focus-visible`/`color-mix()` support. Keep a plain
`:focus` outline as the baseline and only suppress it via
`:focus:not(:focus-visible)`.

- Source: PR #103, `apps/lfx-changelog/src/styles.css` — `.btn:focus {
outline: none }` with only a `:focus-visible` replacement; fixed to keep
  a fallback outline on `:focus`, suppressed only via `:focus:not(:focus-visible)`.

## Match `transition` properties to everything that actually changes on the interaction

If a hover/active state changes both `background-color` and `color`, both
need to be in the `transition` list, or one property snaps while the other
animates.

- Source: PR #103, same file — `.btn-ghost:hover` changed `color` but the
  `.btn` transition list only had `background-color`; fixed by adding `color`
  with matching timing.
