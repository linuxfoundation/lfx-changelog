// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DatePipe } from '@angular/common';
import { Component, inject, input, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RoadmapService } from '@services/roadmap.service';
import { AdfToHtmlPipe } from '@shared/pipes/adf-to-html.pipe';
import { TeamDisplayNamePipe } from '@shared/pipes/team-display-name.pipe';
import { catchError, filter, of, switchMap, tap } from 'rxjs';

import type { Signal } from '@angular/core';
import type { RoadmapComment, RoadmapIdea } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-roadmap-detail-panel',
  imports: [AdfToHtmlPipe, DatePipe, TeamDisplayNamePipe],
  templateUrl: './roadmap-detail-panel.component.html',
  styleUrl: './roadmap-detail-panel.component.css',
})
export class RoadmapDetailPanelComponent {
  private readonly roadmapService = inject(RoadmapService);

  public readonly visible = model(false);
  public readonly jiraKey = input<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly idea: Signal<RoadmapIdea | null> = this.initIdea();
  protected readonly comments: Signal<RoadmapComment[]> = this.initComments();
  protected readonly commentsLoading = signal(false);

  protected close(): void {
    this.visible.set(false);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  private initIdea(): Signal<RoadmapIdea | null> {
    return toSignal(
      toObservable(this.jiraKey).pipe(
        filter((key): key is string => key !== null && key !== ''),
        tap(() => this.loading.set(true)),
        switchMap((key) => this.roadmapService.getIdea(key).pipe(catchError(() => of(null)))),
        tap(() => this.loading.set(false))
      ),
      { initialValue: null }
    );
  }

  private initComments(): Signal<RoadmapComment[]> {
    return toSignal(
      toObservable(this.jiraKey).pipe(
        filter((key): key is string => key !== null && key !== ''),
        tap(() => this.commentsLoading.set(true)),
        switchMap((key) => this.roadmapService.getComments(key).pipe(catchError(() => of([])))),
        tap(() => this.commentsLoading.set(false))
      ),
      { initialValue: [] }
    );
  }
}
