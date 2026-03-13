// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { ThemeService } from '@services/theme.service';
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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly authenticated = this.authService.authenticated;
  protected readonly dbUser = this.authService.dbUser;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly isDark = this.themeService.isDark;
  protected readonly isChatRoute: Signal<boolean> = this.initIsChatRoute();
  protected readonly mobileMenuOpen = signal(false);

  public constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.mobileMenuOpen.set(false));
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
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
