// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ROADMAP_ACTIVE_COLUMNS, ROADMAP_COLUMNS, ROADMAP_TEAM_DISPLAY_NAMES } from '@lfx-changelog/shared';
import { ProductService } from '@services/product.service';
import { RoadmapService } from '@services/roadmap.service';
import { TeamDisplayNamePipe } from '@shared/pipes/team-display-name.pipe';
import { catchError, combineLatest, of, switchMap, tap } from 'rxjs';
import { RoadmapColumnComponent } from '../components/roadmap-column/roadmap-column.component';
import { RoadmapDetailPanelComponent } from '../components/roadmap-detail-panel/roadmap-detail-panel.component';

import type { Signal } from '@angular/core';
import type { PublicProduct, RoadmapBoardResponse } from '@lfx-changelog/shared';

const EMPTY_BOARD: RoadmapBoardResponse = { columns: {}, teams: [], lastFetchedAt: '' };

@Component({
  selector: 'lfx-roadmap-board',
  imports: [RoadmapColumnComponent, RoadmapDetailPanelComponent, TeamDisplayNamePipe],
  templateUrl: './roadmap-board.component.html',
  styleUrl: './roadmap-board.component.css',
})
export class RoadmapBoardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly roadmapService = inject(RoadmapService);

  private readonly productSlugFromQuery = signal(this.route.snapshot.queryParamMap.get('product') ?? '');
  private readonly products = toSignal(this.productService.getPublic(), { initialValue: [] as PublicProduct[] });
  private readonly teamFromQueryProduct = this.initTeamFromQueryProduct();
  protected readonly selectedTeam = signal('');
  protected readonly effectiveTeam = computed(() => this.selectedTeam() || this.teamFromQueryProduct());
  protected readonly loading = signal(true);
  protected readonly showCompleted = signal(false);
  protected readonly selectedIdeaKey = signal<string | null>(null);
  protected readonly detailPanelVisible = signal(false);

  protected readonly board: Signal<RoadmapBoardResponse> = this.initBoard();
  protected readonly activeColumns = computed(() => {
    const board = this.board();
    const show = this.showCompleted();
    const cols = show ? ROADMAP_COLUMNS : ROADMAP_ACTIVE_COLUMNS;
    return cols.map((col) => ({
      name: col,
      ideas: board.columns[col] ?? [],
    }));
  });

  protected readonly completedCount = computed(() => {
    const board = this.board();
    return (board.columns['Done']?.length ?? 0) + (board.columns["Won't do"]?.length ?? 0);
  });

  protected readonly totalIdeas = computed(() => {
    const board = this.board();
    return Object.values(board.columns).reduce((sum, ideas) => sum + ideas.length, 0);
  });

  protected toggleTeam(team: string): void {
    const isActive = this.effectiveTeam() === team;
    if (isActive) {
      this.selectedTeam.set('');
      this.productSlugFromQuery.set('');
      this.updateQueryParam(null);
    } else {
      this.selectedTeam.set(team);
      this.updateQueryParam(this.teamToProductSlug(team));
    }
  }

  protected toggleCompleted(): void {
    this.showCompleted.update((v) => !v);
  }

  protected openDetail(jiraKey: string): void {
    this.selectedIdeaKey.set(jiraKey);
    this.detailPanelVisible.set(true);
  }

  private teamToProductSlug(team: string): string {
    const displayName = ROADMAP_TEAM_DISPLAY_NAMES[team] ?? team;
    return this.products().find((p) => p.name.toLowerCase() === displayName.toLowerCase())?.slug ?? displayName.toLowerCase().replace(/\s+/g, '-');
  }

  private updateQueryParam(productSlug: string | null): void {
    this.router.navigate([], { queryParams: { product: productSlug }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private initTeamFromQueryProduct(): Signal<string> {
    return computed(() => {
      const slug = this.productSlugFromQuery();
      if (!slug) return '';
      const product = this.products().find((p) => p.slug === slug);
      if (!product) return '';
      const productNameLower = product.name.toLowerCase();
      const reverseEntry = Object.entries(ROADMAP_TEAM_DISPLAY_NAMES).find(([, displayName]) => displayName.toLowerCase() === productNameLower);
      return reverseEntry ? reverseEntry[0] : product.name;
    });
  }

  private initBoard(): Signal<RoadmapBoardResponse> {
    return toSignal(
      combineLatest([toObservable(this.effectiveTeam), toObservable(this.showCompleted)]).pipe(
        tap(() => this.loading.set(true)),
        switchMap(([team, includeCompleted]) => this.roadmapService.getBoard(team || undefined, includeCompleted).pipe(catchError(() => of(EMPTY_BOARD)))),
        tap(() => this.loading.set(false))
      ),
      { initialValue: EMPTY_BOARD }
    );
  }
}
