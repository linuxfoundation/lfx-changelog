// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';
import { AgentJobService } from '@services/agent-job.service';
import { AgentStatusColorPipe } from '@shared/pipes/agent-status-color.pipe';
import { AgentStatusLabelPipe } from '@shared/pipes/agent-status-label.pipe';
import { AgentTriggerLabelPipe } from '@shared/pipes/agent-trigger-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { DurationPipe } from '@shared/pipes/duration.pipe';
import { FormatTokensPipe } from '@shared/pipes/format-tokens.pipe';
import { ProgressLogIconPipe } from '@shared/pipes/progress-log-icon.pipe';
import { ProgressLogLabelPipe } from '@shared/pipes/progress-log-label.pipe';
import { catchError, filter, finalize, map, of, scan, startWith, switchMap } from 'rxjs';

import type { AgentJobDetail, AgentJobSSEEvent } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-agent-job-detail',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    TimelineItemComponent,
    AgentStatusColorPipe,
    AgentStatusLabelPipe,
    AgentTriggerLabelPipe,
    DateFormatPipe,
    DurationPipe,
    FormatTokensPipe,
    ProgressLogIconPipe,
    ProgressLogLabelPipe,
  ],
  templateUrl: './agent-job-detail.component.html',
  styleUrl: './agent-job-detail.component.css',
})
export class AgentJobDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly agentJobService = inject(AgentJobService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly cancelling = signal(false);
  protected readonly job = this.initJob();
  protected readonly isActive = computed(() => {
    const j = this.job();
    return j?.status === 'pending' || j?.status === 'running';
  });

  protected cancelJob(): void {
    const j = this.job();
    if (!j || this.cancelling()) return;
    this.cancelling.set(true);
    this.agentJobService
      .cancel(j.id)
      .pipe(
        finalize(() => this.cancelling.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private initJob() {
    return toSignal(
      this.route.paramMap.pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        switchMap((id) =>
          this.agentJobService.getById(id).pipe(
            catchError(() => of(null as AgentJobDetail | null)),
            switchMap((job) => {
              this.loading.set(false);
              if (!job) return of(null);

              // If already terminal, no need to stream
              if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
                return of(job);
              }

              // Stream live updates, accumulating SSE events into job state
              return this.agentJobService.streamJob(id).pipe(
                scan((current, event) => this.applySSEEvent(current, event), job),
                startWith(job),
                catchError(() => of(job))
              );
            })
          )
        )
      ),
      { initialValue: null as AgentJobDetail | null }
    );
  }

  private applySSEEvent(job: AgentJobDetail, event: AgentJobSSEEvent): AgentJobDetail {
    switch (event.type) {
      case 'progress':
        return { ...job, progressLog: [...job.progressLog, event.data] };
      case 'status':
        return { ...job, status: event.data.status };
      case 'stats':
        return {
          ...job,
          durationMs: event.data.durationMs,
          numTurns: event.data.numTurns,
          promptTokens: event.data.promptTokens,
          outputTokens: event.data.outputTokens,
        };
      case 'result':
        return {
          ...job,
          durationMs: event.data.durationMs,
          numTurns: event.data.numTurns,
          promptTokens: event.data.promptTokens,
          outputTokens: event.data.outputTokens,
          changelogEntry: event.data.changelogEntry,
          errorMessage: event.data.errorMessage,
        };
      case 'error':
        return { ...job, errorMessage: event.data };
      default:
        return job;
    }
  }
}
