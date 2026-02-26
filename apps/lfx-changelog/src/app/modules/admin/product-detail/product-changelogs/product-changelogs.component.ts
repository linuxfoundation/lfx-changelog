import { DatePipe, SlicePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { ChangelogService } from '@services/changelog/changelog.service';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

import type { ChangelogEntryWithRelations } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-product-changelogs',
  imports: [DatePipe, SlicePipe, RouterLink, CardComponent],
  templateUrl: './product-changelogs.component.html',
  styleUrl: './product-changelogs.component.css',
})
export class ProductChangelogsComponent implements OnInit {
  private readonly changelogService = inject(ChangelogService);

  public readonly productId = input.required<string>();

  private readonly fetchChangelogs$ = new Subject<void>();

  private readonly changelogsState: Signal<LoadingState<ChangelogEntryWithRelations[]>> = this.initChangelogsState();
  protected readonly changelogs = computed(() => this.changelogsState().data);
  protected readonly loading = computed(() => this.changelogsState().loading);
  protected readonly isEmpty = computed(() => !this.loading() && this.changelogs().length === 0);

  public ngOnInit(): void {
    this.fetchChangelogs$.next();
  }

  private initChangelogsState(): Signal<LoadingState<ChangelogEntryWithRelations[]>> {
    return toSignal(
      this.fetchChangelogs$.pipe(
        switchMap(() =>
          this.changelogService.getAll({ productId: this.productId(), limit: 5 }).pipe(
            map((res) => ({ data: res.data, loading: false })),
            catchError(() => of({ data: [] as ChangelogEntryWithRelations[], loading: false })),
            startWith({ data: [] as ChangelogEntryWithRelations[], loading: true })
          )
        )
      ),
      { initialValue: { data: [], loading: false } }
    );
  }
}
