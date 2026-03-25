# @linuxfoundation/lfx-changelog

Embeddable changelog widget for LFX products. Works with Angular, Vue, React, and plain HTML.

## Installation

```bash
npm install @linuxfoundation/lfx-changelog
# or
yarn add @linuxfoundation/lfx-changelog
```

## Usage

### Basic

```html
<lfx-changelog product="easycla"></lfx-changelog>
```

```js
import '@linuxfoundation/lfx-changelog';
```

### With Options

```html
<lfx-changelog product="easycla" theme="dark" limit="5"></lfx-changelog>
```

### Attributes

| Attribute  | Required | Default                       | Description                    |
| ---------- | -------- | ----------------------------- | ------------------------------ |
| `product`  | Yes      | —                             | Product slug (see table below) |
| `theme`    | No       | `"light"`                     | `"light"` or `"dark"`          |
| `limit`    | No       | `10`                          | Number of entries (max 25)     |
| `base-url` | No       | `"https://changelog.lfx.dev"` | Override API base URL          |

### Available Product Slugs

| Product                 | Slug                      |
| ----------------------- | ------------------------- |
| Changelog               | `changelog`               |
| Community Data Platform | `community-data-platform` |
| Crowdfunding            | `crowdfunding`            |
| EasyCLA                 | `easycla`                 |
| Individual Dashboard    | `individual-dashboard`    |
| Insights                | `insights`                |
| Mentorship              | `mentorship`              |
| Organization Dashboard  | `organization-dashboard`  |
| Project Control Center  | `project-control-center`  |

## Framework Setup

### Angular

```typescript
// In your component
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import '@linuxfoundation/lfx-changelog';

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<lfx-changelog product="easycla" theme="dark"></lfx-changelog>`,
})
export class MyComponent {}
```

### Vue

```typescript
// vite.config.ts (or main.ts)
app.config.compilerOptions.isCustomElement = (tag) => tag === 'lfx-changelog';
```

```vue
<script setup>
import '@linuxfoundation/lfx-changelog';
</script>

<template>
  <lfx-changelog product="easycla" theme="dark"></lfx-changelog>
</template>
```

### Plain HTML (via unpkg CDN)

No build step required — load directly from unpkg:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <lfx-changelog product="easycla"></lfx-changelog>

    <!-- Latest version -->
    <script src="https://unpkg.com/@linuxfoundation/lfx-changelog"></script>

    <!-- Or pin to a specific version -->
    <!-- <script src="https://unpkg.com/@linuxfoundation/lfx-changelog@0.1.0"></script> -->
  </body>
</html>
```

You can also use the ESM build with a module script:

```html
<script type="module">
  import 'https://unpkg.com/@linuxfoundation/lfx-changelog?module';
</script>
<lfx-changelog product="easycla" theme="dark"></lfx-changelog>
```

## Styling Customization

### CSS Custom Properties

Override colors, fonts, and spacing:

```css
lfx-changelog {
  --lfx-font-family: 'Inter', sans-serif;
  --lfx-text-primary: #111827;
  --lfx-bg-surface: #ffffff;
  --lfx-accent: #10b981;
  --lfx-border-radius: 8px;
  --lfx-card-padding: 24px;
}
```

#### Available Properties

| Property               | Default (light)         | Description          |
| ---------------------- | ----------------------- | -------------------- |
| `--lfx-font-family`    | `system-ui, sans-serif` | Font family          |
| `--lfx-font-size-base` | `14px`                  | Base font size       |
| `--lfx-text-primary`   | `#1a1a2e`               | Primary text color   |
| `--lfx-text-secondary` | `#64748b`               | Secondary text color |
| `--lfx-text-muted`     | `#94a3b8`               | Muted text color     |
| `--lfx-text-link`      | `#3b82f6`               | Link color           |
| `--lfx-bg-surface`     | `#ffffff`               | Background color     |
| `--lfx-bg-surface-alt` | `#f8fafc`               | Alt background       |
| `--lfx-border-color`   | `#e2e8f0`               | Border color         |
| `--lfx-accent`         | `#3b82f6`               | Accent color         |
| `--lfx-accent-bg`      | `#eff6ff`               | Accent background    |
| `--lfx-border-radius`  | `12px`                  | Card border radius   |
| `--lfx-card-padding`   | `20px`                  | Card padding         |
| `--lfx-card-gap`       | `16px`                  | Gap between cards    |

### `::part()` Selectors

Target specific elements inside the widget:

```css
lfx-changelog::part(container) {
  /* Outer wrapper */
}
lfx-changelog::part(header) {
  /* Header section */
}
lfx-changelog::part(heading) {
  /* h2 heading */
}
lfx-changelog::part(list) {
  /* Card list wrapper */
}
lfx-changelog::part(card) {
  /* Individual card */
}
lfx-changelog::part(meta) {
  /* Version + date row */
}
lfx-changelog::part(version) {
  /* Version badge */
}
lfx-changelog::part(date) {
  /* Date text */
}
lfx-changelog::part(title) {
  /* Card title */
}
lfx-changelog::part(description) {
  /* Markdown content */
}
lfx-changelog::part(footer) {
  /* Footer section */
}
lfx-changelog::part(link) {
  /* "View all" link */
}
lfx-changelog::part(loading) {
  /* Loading skeleton */
}
lfx-changelog::part(error) {
  /* Error state */
}
lfx-changelog::part(retry) {
  /* Retry button */
}
lfx-changelog::part(empty) {
  /* Empty state */
}
```

Example:

```css
lfx-changelog::part(card) {
  border-left: 3px solid var(--lfx-accent);
}

lfx-changelog::part(date) {
  display: none;
}
```

## SSR Compatibility

The widget is SSR-safe. On the server, `customElements.define()` is skipped (guarded by `typeof window !== 'undefined'`). The element renders nothing during SSR and hydrates on the client.

## License

MIT
