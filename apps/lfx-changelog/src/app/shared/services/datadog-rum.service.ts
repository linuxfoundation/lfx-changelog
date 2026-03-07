// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import type { AuthUser } from '@lfx-changelog/shared';

@Injectable({ providedIn: 'root' })
export class DataDogRumService {
  private readonly platformId = inject(PLATFORM_ID);

  public setUser(user: AuthUser): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    import('@datadog/browser-rum').then(({ datadogRum }) => {
      datadogRum.setUser({
        id: user.sub,
        name: user.name,
        email: user.email,
      });
    });
  }

  public clearUser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    import('@datadog/browser-rum').then(({ datadogRum }) => {
      datadogRum.clearUser();
    });
  }
}
