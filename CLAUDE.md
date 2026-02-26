# LFX Changelog — Project Rules

## Project Overview

Monorepo: Turborepo + Yarn 4 workspaces. Angular 20 SSR app at `apps/lfx-changelog`, shared package at `packages/shared` (`@lfx-changelog/shared`), Express 5 backend, PostgreSQL + Prisma ORM, Auth0.

---

## Angular Component Rules

### File Structure
- **NEVER inline templates or CSS** — always use separate `.html` and `.css` files (`templateUrl` / `styleUrl`), never `template:` or `styles:` in the component decorator
- **Every component/service/directive in its own subfolder** — e.g. `shared/components/button/button.component.ts`
- File naming: 2016 convention (`button.component.ts`, `button.component.html`, `button.component.css`)
- Prefix: `lfx`
- Use Angular 20 patterns: standalone components, signal-based inputs/outputs (`input()`, `output()`, `model()`), `computed()`, zoneless

### Forms — ALWAYS Use ReactiveFormsModule (CRITICAL)

**ALWAYS use ReactiveFormsModule** for any form inputs:
- Text inputs, textareas
- Checkboxes, radio buttons
- Select dropdowns
- Any `lfx-*` form wrapper component

**NEVER use:**
- `(input)`, `(change)` event bindings to set signal values
- `[(ngModel)]` with `FormsModule`
- Template-driven forms

**Correct pattern (consumer):**
```typescript
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

export class MyComponent {
  public titleControl = new FormControl('');

  // Use toSignal to convert form value to signal if needed for computed
  public titleValue = toSignal(this.titleControl.valueChanges, { initialValue: '' });
}
```

```html
<lfx-input label="Title" [formControl]="titleControl" placeholder="Enter title..." />
```

**Correct pattern (wrapper component implementing ControlValueAccessor):**
```typescript
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'lfx-input',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InputComponent), multi: true }],
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
})
export class InputComponent implements ControlValueAccessor {
  // ... ControlValueAccessor methods
}
```

**Wrong pattern:**
```html
<!-- NEVER do this -->
<lfx-input [(value)]="title" />
<input [(ngModel)]="title" />
<input (input)="title.set($event.target.value)" />
```

### Template Rules (CRITICAL)

**NEVER use functions in HTML templates** — use signals, computed values, or pipes:

```html
<!-- WRONG - function call in template -->
<span>{{ formatDate(item.date) }}</span>
<div *ngIf="isValid(item)">...</div>

<!-- CORRECT - use pipe -->
<span>{{ item.date | date: 'MMM d, yyyy' }}</span>

<!-- CORRECT - use computed signal -->
@if (isItemValid()) {
  <div>...</div>
}
```

**ALWAYS use Tailwind CSS in HTML first** instead of custom CSS classes:

```html
<!-- CORRECT - Tailwind classes -->
<div class="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">

<!-- AVOID - custom CSS class -->
<div class="my-custom-card">
```

Only use custom `.css` when absolutely necessary:
- Complex animations (`@keyframes`)
- Pseudo-element styling that Tailwind can't handle
- Prose/markdown content styling (e.g. `prose-themed` class)
- State-based styling with complex selectors

### Signal Patterns

#### 1. WritableSignals — Initialize directly for simple values
```typescript
public loading = signal(false);
public count = signal(0);
public items = signal<string[]>([]);
```

#### 2. Model Signals — Use for two-way binding on presentational props
For properties that require two-way binding (e.g., dialog visibility), use `model()`:
```typescript
import { model } from '@angular/core';

export class DialogComponent {
  public visible = model(false);
}
```
```html
<lfx-dialog [(visible)]="dialogVisible">...</lfx-dialog>
```
**Note:** `model()` is for non-form two-way binding (dialogs, tabs, toggles). For form values, always use `FormControl` with `ReactiveFormsModule`.

#### 3. Computed/toSignal — Use private init functions for complex logic
```typescript
export class MyComponent {
  public loading = signal(false);
  public searchTerm = signal('');

  // Complex computed/toSignal — use private init functions
  public filteredItems: Signal<Item[]> = this.initFilteredItems();

  private initFilteredItems(): Signal<Item[]> {
    return computed(() => {
      const term = this.searchTerm().toLowerCase();
      return this.items().filter((item) => item.name.toLowerCase().includes(term));
    });
  }
}
```

#### 4. Avoid effect() — Use toObservable Instead (CRITICAL)

`effect()` triggers whenever ANY signal in the component updates, not just the signals read inside the effect. This causes unintended re-executions.

**AVOID:**
```typescript
effect(() => {
  const types = this.passTypes();
  if (types.length > 0) {
    this.initializeForm(types); // Re-runs unexpectedly!
  }
});
```

**USE toObservable with pipes instead:**
```typescript
private destroyRef = inject(DestroyRef);

public constructor() {
  toObservable(this.passTypes)
    .pipe(
      filter((types) => types.length > 0),
      first(),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe((types) => {
      this.initializeForm(types);
    });
}
```

**When effect() is acceptable:**
- Logging/debugging during development
- Syncing to external systems that need ALL changes
- Simple one-liner side effects with no conditions

#### 5. Component structure order
1. Private injections (with `readonly`)
2. Public fields from inputs/dialog data (with `readonly`)
3. Forms (`FormControl`, `FormGroup`)
4. Model signals for two-way binding (`model()`)
5. Simple WritableSignals (direct initialization)
6. Complex computed/toSignal signals (via private init functions)
7. Public methods
8. Private initializer functions (grouped together)
9. Other private helper methods

#### 6. Interface placement
- **Shared interfaces** in `packages/shared/src/interfaces/` — exported via `@lfx-changelog/shared`
- **App-specific interfaces** in `apps/lfx-changelog/src/app/shared/interfaces/`
- Group related interfaces in domain-specific files (e.g., `product.interface.ts`, `user.interface.ts`)
- Never define interfaces inside component files — move them to the shared folder

---

## Styling

- **Tailwind CSS v4** — CSS-first config via `@theme` block in `styles.css`, no `tailwind.config.js`
- **`.css` files only** — no SCSS (Tailwind v4 CSS-first approach makes SCSS unnecessary)
- **Semantic color tokens** — use `bg-surface`, `text-text-primary`, `border-border` etc. (defined as CSS custom properties that swap in `.dark {}` block)
- **Light mode default** — dark mode toggled via `.dark` class on `<html>`

---

## Tooling Preferences

- **Always use `yarn`** instead of `npx` (e.g., `yarn prisma generate`, NOT `npx prisma generate`)
- **Always use `docker compose`** instead of `docker-compose`
