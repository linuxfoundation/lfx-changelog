// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { PostToSlackDialogComponent } from '@components/post-to-slack-dialog/post-to-slack-dialog.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { AuthService } from '@services/auth.service';
import { ChangelogService } from '@services/changelog.service';
import { DialogService } from '@services/dialog.service';
import { format } from 'date-fns';
import { catchError, filter, first, of, tap } from 'rxjs';

@Component({
  selector: 'lfx-changelog-detail',
  imports: [MarkdownRendererComponent, ProductPillComponent, CardComponent, RouterLink, ButtonComponent],
  templateUrl: './changelog-detail.component.html',
  styleUrl: './changelog-detail.component.css',
})
export class ChangelogDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly changelogService = inject(ChangelogService);
  private readonly dialogService = inject(DialogService);

  protected readonly loading = signal(true);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly entry = toSignal(
    this.changelogService.getPublishedById(this.route.snapshot.paramMap.get('slug') ?? '').pipe(
      tap(() => this.loading.set(false)),
      catchError(() => {
        this.loading.set(false);
        return of(undefined);
      })
    )
  );

  protected readonly product = computed(() => this.entry()?.product);

  protected readonly author = computed(() => this.entry()?.author);

  protected readonly formattedPublishedAt = computed(() => {
    const e = this.entry();
    if (!e?.publishedAt) return 'Not published';
    return format(new Date(e.publishedAt), 'MMMM d, yyyy');
  });

  protected readonly formattedCreatedAt = computed(() => {
    const e = this.entry();
    if (!e) return '';
    return format(new Date(e.createdAt), 'MMMM d, yyyy');
  });

  public constructor() {
    this.initPostToSlackFromQueryParam();
  }

  protected openSlackDialog(): void {
    const e = this.entry();
    if (!e || !this.isAdmin()) return;

    this.dialogService.open({
      title: 'Post to Slack',
      size: 'sm',
      component: PostToSlackDialogComponent,
      inputs: { changelogId: e.id, changelogTitle: e.title },
    });
  }

  private initPostToSlackFromQueryParam(): void {
    if (this.route.snapshot.queryParamMap.get('postToSlack') !== 'true') return;

    // Strip the query param so refresh doesn't re-trigger
    this.router.navigate([], { queryParams: { postToSlack: null }, queryParamsHandling: 'merge', replaceUrl: true });

    toObservable(this.entry)
      .pipe(takeUntilDestroyed(), filter(Boolean), first())
      .subscribe(() => this.openSlackDialog());
  }
}
