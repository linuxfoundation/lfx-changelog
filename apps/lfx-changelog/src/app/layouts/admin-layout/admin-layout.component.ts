import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '@services/theme/theme.service';

@Component({
  selector: 'lfx-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly sidebarCollapsed = signal(false);
  protected readonly isDark = this.themeService.isDark;

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
