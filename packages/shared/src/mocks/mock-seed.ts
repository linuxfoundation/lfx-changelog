// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Faker, en } from '@faker-js/faker';

const faker = new Faker({ locale: [en] });
faker.seed(42);

// Product IDs — named for cross-reference clarity
export const PRODUCT_IDS = {
  ORG_DASHBOARD: faker.string.uuid(),
  INDIVIDUAL_DASHBOARD: faker.string.uuid(),
  PCC: faker.string.uuid(),
  SECURITY: faker.string.uuid(),
  EASYCLA: faker.string.uuid(),
  INSIGHTS: faker.string.uuid(),
  MENTORSHIP: faker.string.uuid(),
  CROWDFUNDING: faker.string.uuid(),
  COMMUNITY_DATA: faker.string.uuid(),
} as const;

// User IDs — keyed by role for readability
export const USER_IDS = {
  SUPER_ADMIN: faker.string.uuid(),
  PRODUCT_ADMIN_1: faker.string.uuid(),
  EDITOR_1: faker.string.uuid(),
  PRODUCT_ADMIN_2: faker.string.uuid(),
  EDITOR_2: faker.string.uuid(),
  EDITOR_3: faker.string.uuid(),
} as const;

// Role assignment IDs (9 total)
export const ROLE_IDS = Array.from({ length: 9 }, () => faker.string.uuid());

// Changelog entry IDs (18 total)
export const ENTRY_IDS = Array.from({ length: 18 }, () => faker.string.uuid());

// User personas — generated personal data
function createPersona(): { name: string; email: string; avatarUrl: string; auth0Id: string } {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName, provider: 'linuxfoundation.org' }).toLowerCase(),
    avatarUrl: faker.image.avatar(),
    auth0Id: `auth0|${faker.string.alphanumeric(24)}`,
  };
}

export const USER_PERSONAS = {
  SUPER_ADMIN: createPersona(),
  PRODUCT_ADMIN_1: createPersona(),
  EDITOR_1: createPersona(),
  PRODUCT_ADMIN_2: createPersona(),
  EDITOR_2: createPersona(),
  EDITOR_3: createPersona(),
} as const;
