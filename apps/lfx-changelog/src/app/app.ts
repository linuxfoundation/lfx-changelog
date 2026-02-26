// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, makeStateKey, REQUEST_CONTEXT, TransferState } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { AuthContext } from '@lfx-changelog/shared';

import { AuthService } from '@services/auth/auth.service';

@Component({
  selector: 'lfx-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly transferState = inject(TransferState);
  private readonly authKey = makeStateKey<AuthContext>('auth');

  public constructor() {
    const reqContext = inject(REQUEST_CONTEXT, { optional: true }) as { auth: AuthContext } | null;

    if (reqContext?.auth) {
      this.transferState.set(this.authKey, reqContext.auth);
    }

    const auth = this.transferState.get(this.authKey, {
      authenticated: false,
      user: null,
      dbUser: null,
    });

    if (auth.authenticated && auth.user) {
      this.authService.authenticated.set(true);
      this.authService.user.set(auth.user);
      this.authService.dbUser.set(auth.dbUser);
    }
  }
}
