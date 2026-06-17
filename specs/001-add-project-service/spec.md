# Feature Specification: Track LFX V2 Project Service in Changelog

**Feature Branch**: `001-add-project-service`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "I would like to add the following API as a new item to track in the change log. Here's the Repository: https://github.com/linuxfoundation/lfx-v2-project-service"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Public discovery of Project Service releases (Priority: P1)

As an LFX platform user or stakeholder, I want to find the LFX V2 Project Service in the public changelog catalog so I can read what changed in each release without visiting GitHub directly.

**Why this priority**: The core value of this feature is making Project Service release information discoverable in the centralized LFX changelog.

**Independent Test**: Can be fully tested by creating the product, linking the repository, syncing releases, and verifying the product appears on the public changelog feed with release metadata visible to unauthenticated visitors.

**Acceptance Scenarios**:

1. **Given** the Project Service product is active and its GitHub repository is linked, **When** a visitor opens the public changelog product list, **Then** they see "LFX V2 Project Service" with its description and icon.
2. **Given** the repository has published GitHub releases, **When** a visitor opens the product's public changelog page, **Then** they can see release version tags and associated changelog entries or release notes sourced from GitHub.
3. **Given** a new GitHub release is published for `linuxfoundation/lfx-v2-project-service`, **When** the webhook is processed, **Then** the release appears in the changelog system without manual re-entry.

---

### User Story 2 - Admin configures and maintains the product (Priority: P2)

As a changelog administrator, I want to register the Project Service as a product and connect its GitHub repository so release tracking and automated changelog generation can run for that service.

**Why this priority**: Repository linking and product metadata are prerequisites for automated release sync and AI-assisted changelog drafting.

**Independent Test**: Can be fully tested by a super admin or product admin creating the product, connecting the repository via the GitHub App flow, triggering a release sync, and confirming repository and release records exist in the admin UI.

**Acceptance Scenarios**:

1. **Given** an authorized admin user, **When** they create a new product with the agreed name, slug, and description, **Then** the product is saved and appears in the admin product list.
2. **Given** the product exists, **When** the admin connects `linuxfoundation/lfx-v2-project-service` through the GitHub App installation flow, **Then** the repository is linked to the product and shown on the product detail page.
3. **Given** a linked repository with no historical backfill, **When** a new GitHub release is published after connection, **Then** that release (tagged `v*`) is stored and visible on the repositories admin page.

---

### User Story 3 - Automated changelog drafts from repository activity (Priority: P3)

As a product maintainer, I want changelog drafts generated automatically when Project Service code is merged or released so I can review and publish user-facing release notes faster.

**Why this priority**: Automation reduces manual effort but depends on Stories 1–2 being complete.

**Independent Test**: Can be fully tested by simulating or receiving a GitHub `release`, `push`, or merged `pull_request` event for the linked repository and verifying a draft changelog entry is created for human review.

**Acceptance Scenarios**:

1. **Given** the repository is linked and webhooks are configured, **When** a release is published on the default branch, **Then** the system creates or updates a draft changelog entry for the product.
2. **Given** a draft changelog entry exists, **When** a product admin reviews and publishes it, **Then** the entry becomes visible on the public product changelog page.

---

### Edge Cases

- What happens when the GitHub App is not installed on the `linuxfoundation` organization or lacks access to `lfx-v2-project-service`? The admin must complete installation before repository linking succeeds; the system should surface a clear error rather than silently failing.
- How does the system handle draft or prerelease GitHub releases? They should be stored with correct flags and should not be presented as stable public releases unless explicitly published as changelog entries.
- What happens if the product slug conflicts with an existing product? Creation must fail with a validation error so administrators choose a unique slug.
- What happens when release tags do not follow the repository's `v{version}` convention? Releases should still sync, but version ordering and changelog agent suggestions may be less reliable.
- What happens when an admin triggers a manual full release sync after connection? Historical releases predating the connection date MUST NOT be imported; only releases published after repository link are in scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a new product representing the LFX V2 Project Service API with a unique name and slug.
- **FR-002**: System MUST allow linking the GitHub repository `linuxfoundation/lfx-v2-project-service` to that product via the existing GitHub App repository-tracking flow.
- **FR-003**: System MUST sync GitHub release metadata (tag, title, body, publish date, draft/prerelease state) from the linked repository into the changelog platform.
- **FR-004**: System MUST display the product on the public changelog catalog when the product is marked active.
- **FR-005**: System MUST process GitHub webhook events for the linked repository to keep releases current and trigger automated changelog draft generation per existing product behavior.
- **FR-006**: System MUST restrict product creation, repository linking, and changelog publishing to authorized admin roles (super admin and assigned product admin).
- **FR-007**: Product metadata MUST include a human-readable description suitable for public display; a Font Awesome icon class or icon URL SHOULD be provided for visual consistency with other LFX products.
- **FR-008**: Members of the LFX platform/changelog team MUST be assigned the `product_admin` role for this product to own ongoing changelog curation and publishing.
- **FR-009**: System MUST NOT backfill historical GitHub releases on initial repository link; release tracking begins at connection time and only captures releases published thereafter.
- **FR-010**: Public product display name MUST be "LFX V2 Project Service".

### Key Entities

- **Product**: The changelog catalog entry for the Project Service; includes name, slug, description, icon, and active status.
- **ProductRepository**: The link between the product and `linuxfoundation/lfx-v2-project-service`, including GitHub App installation ID and sync timestamps.
- **GitHubRelease**: Synced release records (e.g., `v0.8.2`) used for admin visibility and automated changelog context.
- **ChangelogEntry**: User-facing release notes (manual or automated drafts) associated with the product and optionally tied to a version.
- **UserRoleAssignment**: Maps product admins to the new product for RBAC-controlled editing and publishing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within one business day of a new GitHub release being published after repository connection, that release is visible to admins in the changelog system.
- **SC-002**: Public visitors can locate the Project Service product in the changelog catalog and open its changelog page without authentication.
- **SC-003**: A newly published GitHub release appears in the admin release list within 5 minutes of webhook delivery under normal operating conditions.
- **SC-004**: Assigned product admins can create, edit, and publish changelog entries for the product without super-admin intervention.
- **SC-005**: At least one reviewed changelog entry is publishable for the product within the first week of go-live (manual or automated draft acceptable).

## Assumptions

- The repository URL `https://github.com/linuxfoundation/lfx-v2-project-service` is the sole source repository for this product's release tracking (no additional mono-repo or chart-only repos required unless later specified).
- The repository is public and uses GitHub releases tagged with `v{semver}` (e.g., `v0.8.2`), consistent with the service's documented release process.
- The Linux Foundation GitHub organization can grant the existing LFX Changelog GitHub App access to this repository.
- Product display name is "LFX V2 Project Service"; default slug is `lfx-v2-project-service`; default description derived from the repository README: RESTful API for creating, reading, updating, and deleting LFX platform projects with authorization and audit capabilities.
- Historical releases (~37 existing tags) are intentionally excluded; changelog tracking starts at repository connection time.
- The LFX platform/changelog team will be assigned `product_admin` and is responsible for reviewing and publishing changelog entries.
- The product will be active (`isActive: true`) and publicly listed unless stakeholders request a staged/hidden launch.
- Slack notification recipients and newsletter inclusion are out of scope unless explicitly requested.
- Development seed data may optionally include this product for local/E2E environments, but production onboarding may occur through the admin UI only.
