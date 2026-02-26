// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@services/auth/auth.service';
import { ThemeService } from '@services/theme/theme.service';

@Component({
  selector: 'lfx-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly userMenuButtonRef = viewChild<ElementRef>('userMenuButton');
  private readonly userMenuPopupRef = viewChild<ElementRef>('userMenuArea');

  protected readonly authUser = this.authService.user;
  protected readonly userInitial = computed(() => this.authUser()?.name?.charAt(0)?.toUpperCase() || '?');
  protected readonly sidebarCollapsed = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly userMenuBottom = signal(0);
  protected readonly userMenuLeft = signal(0);
  protected readonly isDark = this.themeService.isDark;

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected toggleUserMenu(): void {
    const button = this.userMenuButtonRef()?.nativeElement;
    if (button) {
      const rect = button.getBoundingClientRect();
      this.userMenuBottom.set(window.innerHeight - rect.top + 4);
      this.userMenuLeft.set(rect.left);
    }
    this.userMenuOpen.update((v) => !v);
  }

  protected onDocumentClick(event: MouseEvent): void {
    const button = this.userMenuButtonRef()?.nativeElement;
    const popup = this.userMenuPopupRef()?.nativeElement;
    const target = event.target as Node;
    if (button?.contains(target) || popup?.contains(target)) {
      return;
    }
    this.userMenuOpen.set(false);
  }
}
