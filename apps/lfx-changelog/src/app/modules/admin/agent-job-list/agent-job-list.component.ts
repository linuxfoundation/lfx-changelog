// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { SelectComponent } from '@components/select/select.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { TriggerAgentDialogComponent } from '@modules/admin/trigger-agent-dialog/trigger-agent-dialog.component';
import { AgentJobService } from '@services/agent-job.service';
import { DialogService } from '@services/dialog.service';
import { ProductService } from '@services/product.service';
import { AgentStatusColorPipe } from '@shared/pipes/agent-status-color.pipe';
import { AgentStatusLabelPipe } from '@shared/pipes/agent-status-label.pipe';
import { AgentTriggerLabelPipe } from '@shared/pipes/agent-trigger-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { DurationPipe } from '@shared/pipes/duration.pipe';
import { FormatTokensPipe } from '@shared/pipes/format-tokens.pipe';
import { BehaviorSubject, catchError, combineLatest, finalize, map, of, startWith, switchMap, tap } from 'rxjs';

import type { AgentJobSSEEvent, AgentJobWithProduct, PaginatedResponse, Product } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'lfx-agent-job-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    PaginationComponent,
    SelectComponent,
    TableComponent,
    TableColumnDirective,
    AgentStatusColorPipe,
    AgentStatusLabelPipe,
    AgentTriggerLabelPipe,
    DateFormatPipe,
    DurationPipe,
    FormatTokensPipe,
  ],
  templateUrl: './agent-job-list.component.html',
  styleUrl: './agent-job-list.component.css',
})
export class AgentJobListComponent {
  private readonly agentJobService = inject(AgentJobService);
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  private static readonly defaultPageSize = 20;

  // Per-row SSE subscription tracking
  private readonly activeStreams = new Map<string, Subscription>();
  private readonly jobUpdates = signal<Map<string, Partial<AgentJobWithProduct>>>(new Map());

  protected readonly productFilterControl = new FormControl('', { nonNullable: true });
  protected readonly statusFilterControl = new FormControl('', { nonNullable: true });

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly loading = signal(true);

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();
  protected readonly statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Running', value: 'running' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  protected readonly pageState = this.initPageState();
  protected readonly jobs: Signal<AgentJobWithProduct[]> = this.initJobs();
  protected readonly currentPage = computed(() => this.pageState().page);
  protected readonly totalPages = computed(() => this.pageState().totalPages);
  protected readonly totalItems = computed(() => this.pageState().total);
  protected readonly pageSize = computed(() => this.pageState().pageSize);
  protected readonly hasActiveJobs = computed(() => this.jobs().some((j) => j.status === 'pending' || j.status === 'running'));
  protected readonly cancellingJobs = signal(new Set<string>());

  public constructor() {
    combineLatest([this.productFilterControl.valueChanges, this.statusFilterControl.valueChanges])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));

    this.destroyRef.onDestroy(() => this.cleanupAllStreams());
  }

  protected onPageChange(page: number): void {
    this.page$.next(page);
  }

  protected cancelJob(jobId: string): void {
    const current = this.cancellingJobs();
    if (current.has(jobId)) return;
    this.cancellingJobs.set(new Set([...current, jobId]));
    this.agentJobService
      .cancel(jobId)
      .pipe(
        finalize(() => {
          const updated = new Set(this.cancellingJobs());
          updated.delete(jobId);
          this.cancellingJobs.set(updated);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  protected openTriggerDialog(): void {
    this.dialogService.open({
      title: 'Run Agent',
      size: 'sm',
      component: TriggerAgentDialogComponent,
      inputs: {
        productOptions: this.productOptions().filter((o) => o.value !== ''),
        onTriggered: () => this.refresh$.next(),
      },
    });
  }

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => [
      { label: 'All Products', value: '' },
      ...this.products()
        .filter((p) => p.isActive)
        .map((p) => ({ label: p.name, value: p.id })),
    ]);
  }

  /** Merges base API data with per-row SSE overrides. */
  private initJobs(): Signal<AgentJobWithProduct[]> {
    return computed(() => {
      const base = this.pageState().jobs;
      const updates = this.jobUpdates();
      if (updates.size === 0) return base;
      return base.map((job) => {
        const update = updates.get(job.id);
        return update ? { ...job, ...update } : job;
      });
    });
  }

  private initPageState() {
    return toSignal(
      combineLatest([
        this.productFilterControl.valueChanges.pipe(startWith(this.productFilterControl.value)),
        this.statusFilterControl.valueChanges.pipe(startWith(this.statusFilterControl.value)),
        this.page$,
        this.refresh$,
      ]).pipe(
        tap(() => this.loading.set(true)),
        switchMap(([productId, status, page]) =>
          this.agentJobService
            .getAll({
              ...(productId ? { productId } : {}),
              ...(status ? { status: status as 'pending' | 'running' | 'completed' | 'failed' } : {}),
              page,
              limit: AgentJobListComponent.defaultPageSize,
            })
            .pipe(
              map((res: PaginatedResponse<AgentJobWithProduct>) => ({
                jobs: res.data,
                total: res.total,
                page: res.page,
                pageSize: res.pageSize,
                totalPages: res.totalPages,
              })),
              catchError(() => of({ jobs: [], total: 0, page: 1, pageSize: AgentJobListComponent.defaultPageSize, totalPages: 0 }))
            )
        ),
        tap((state) => {
          this.loading.set(false);
          this.jobUpdates.set(new Map());
          this.manageStreams(state.jobs);
        })
      ),
      { initialValue: { jobs: [] as AgentJobWithProduct[], total: 0, page: 1, pageSize: AgentJobListComponent.defaultPageSize, totalPages: 0 } }
    );
  }

  /** Opens SSE streams for active jobs, closes streams for jobs no longer active or on page. */
  private manageStreams(jobs: AgentJobWithProduct[]): void {
    const activeJobIds = new Set(jobs.filter((j) => j.status === 'pending' || j.status === 'running').map((j) => j.id));

    // Unsubscribe streams for jobs no longer active/on page
    for (const [id, sub] of this.activeStreams) {
      if (!activeJobIds.has(id)) {
        sub.unsubscribe();
        this.activeStreams.delete(id);
      }
    }

    // Subscribe to new active jobs
    for (const id of activeJobIds) {
      if (!this.activeStreams.has(id)) {
        const sub = this.agentJobService.streamJob(id).subscribe({
          next: (event) => this.applySSEToRow(id, event),
          complete: () => this.activeStreams.delete(id),
          error: () => this.activeStreams.delete(id),
        });
        this.activeStreams.set(id, sub);
      }
    }
  }

  /** Applies an SSE event to a single row in the jobs list (status + result only). */
  private applySSEToRow(jobId: string, event: AgentJobSSEEvent): void {
    let update: Partial<AgentJobWithProduct> | null = null;

    switch (event.type) {
      case 'status':
        update = { status: event.data.status };
        break;
      case 'result':
        update = {
          durationMs: event.data.durationMs,
          numTurns: event.data.numTurns,
          promptTokens: event.data.promptTokens,
          outputTokens: event.data.outputTokens,
          errorMessage: event.data.errorMessage,
        };
        break;
    }

    if (update) {
      const current = new Map(this.jobUpdates());
      current.set(jobId, { ...(current.get(jobId) || {}), ...update });
      this.jobUpdates.set(current);
    }
  }

  private cleanupAllStreams(): void {
    for (const sub of this.activeStreams.values()) {
      sub.unsubscribe();
    }
    this.activeStreams.clear();
  }
}
