import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@services/auth/auth.service';
import { ThemeService } from '@services/theme/theme.service';

@Component({
  selector: 'lfx-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.css',
})
export class PublicLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  protected readonly authenticated = this.authService.authenticated;
  protected readonly dbUser = this.authService.dbUser;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly isDark = this.themeService.isDark;

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
