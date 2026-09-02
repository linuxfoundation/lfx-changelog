<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Validation and schema patterns

Patterns extracted from past PR review comments on Zod schemas and the
server-side validation they're supposed to guarantee.

## Truthiness checks reject legitimate falsy updates

`if (updates.title || updates.excerpt || ...)`-style "has any update" checks
treat an explicitly-provided empty string (or other falsy value) as "no
update", silently dropping a legitimate field-clearing request. Use
`!== undefined` per field, or `Object.values(updates).some(v => v !== undefined)`.

- Source: PR #94, `apps/lfx-changelog/src/server/services/ai.service.ts` —
  `hasUpdate` used `||` truthiness; fixed to `!== undefined` checks.

## Zod schema must match the runtime contract it's supposed to describe

When a tool/endpoint's implementation enforces a rule at runtime (e.g. "at
least one of title/excerpt/description required", "productIds must be
non-empty", "productId and productIds are mutually exclusive"), the Zod
schema should encode the same rule via `.refine()`, not just describe the
shape. A schema that's looser than the code it validates produces confusing
errors deep inside the handler instead of a clean 400 at the boundary.

- Source: PR #94, `packages/shared/src/schemas/chat.schema.ts` —
  `UpdateBlogToolArgsSchema` allowed `{ id }`-only calls the tool rejected at
  runtime; fixed with `.refine()` requiring at least one optional field.
- Source: PR #93, `packages/shared/src/schemas/dto.schema.ts` —
  `BatchAssignRoleRequestSchema.productIds` allowed `[]` and non-UUID
  strings; fixed with `z.string().uuid().min(1)`.
- Source: PR #93, same file — `CreateUserRequestSchema` allowed both
  `productId` and `productIds` simultaneously with server-side precedence
  the client couldn't see; fixed with a `.refine()` enforcing mutual
  exclusivity.

## Sentinel values for "no product" / "global" leak into multiple layers

Using `''` (empty string) as a wire-level sentinel for "global/no product"
(instead of omitting the field or sending `null`) tends to need normalizing
in more than one place — schema, service layer, and any consumer that reads
the field — and it's easy to miss one. Prefer expressing "global" with an
explicit `null` or a dedicated flag instead of an empty-string convention.

- Source: PR #93, `apps/lfx-changelog/src/server/services/user.service.ts` —
  `createWithRole` used `pid ?? null`, which persists `''` if a client sends
  it (nullish coalescing doesn't catch empty string); the codebase's other
  call site (`assignRoles`) already normalized with `||`. Fixed to `pid || null`.
