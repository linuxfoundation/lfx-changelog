// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type { ApiResponse, ReleaseNotesPreview, ReleasePlan, ReleasableService } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReleasableServiceService {
  private readonly http = inject(HttpClient);

  public list(): Observable<ReleasableService[]> {
    return this.http.get<ApiResponse<ReleasableService[]>>('/api/releasable-services').pipe(map((res) => res.data));
  }

  public plan(key: string): Observable<ReleasePlan> {
    return this.http.get<ApiResponse<ReleasePlan>>(`/api/releasable-services/${encodeURIComponent(key)}/plan`).pipe(map((res) => res.data));
  }

  public generateNotes(key: string): Observable<string> {
    return this.http.post<ApiResponse<ReleaseNotesPreview>>(`/api/releasable-services/${encodeURIComponent(key)}/notes`, {}).pipe(
      map((res) => res.data.notes),
      take(1)
    );
  }

  public updateMapping(key: string, productId: string | null): Observable<unknown> {
    return this.http.put(`/api/releasable-services/${encodeURIComponent(key)}/mapping`, { productId }).pipe(take(1));
  }
}
