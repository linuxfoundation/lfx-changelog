import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChangelogStatus, MOCK_CHANGELOG_ENTRIES, MOCK_PRODUCTS } from '@lfx-changelog/shared';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';

@Component({
  selector: 'lfx-admin-dashboard',
  imports: [StatusBadgeComponent, RouterLink, DateFormatPipe, ProductNamePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent {
  protected readonly totalEntries = MOCK_CHANGELOG_ENTRIES.length;

  protected readonly draftCount = MOCK_CHANGELOG_ENTRIES.filter((e) => e.status === ChangelogStatus.DRAFT).length;

  protected readonly publishedCount = MOCK_CHANGELOG_ENTRIES.filter((e) => e.status === ChangelogStatus.PUBLISHED).length;

  protected readonly productCount = MOCK_PRODUCTS.length;

  protected readonly recentEntries = MOCK_CHANGELOG_ENTRIES.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
}
