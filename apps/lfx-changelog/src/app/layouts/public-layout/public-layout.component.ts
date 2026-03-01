// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@services/auth/auth.service';
import { ThemeService } from '@services/theme/theme.service';
import { filter, map } from 'rxjs';

import type { Signal } from '@angular/core';

@Component({
  selector: 'lfx-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.css',
})
export class PublicLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly authenticated = this.authService.authenticated;
  protected readonly dbUser = this.authService.dbUser;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly isDark = this.themeService.isDark;
  protected readonly isChatRoute: Signal<boolean> = this.initIsChatRoute();

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  private initIsChatRoute(): Signal<boolean> {
    const url = toSignal(
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => e.urlAfterRedirects)
      ),
      { initialValue: this.router.url }
    );
    return computed(() => url() === '/chat');
  }
}
