// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type { ApiResponse, RepositoryWithCounts } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly http = inject(HttpClient);

  public getAll(): Observable<RepositoryWithCounts[]> {
    return this.http.get<ApiResponse<RepositoryWithCounts[]>>('/api/releases/repositories').pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public syncProduct(productId: string): Observable<{ synced: number }> {
    return this.http.post<ApiResponse<{ synced: number }>>(`/api/releases/sync/${productId}`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public syncRepository(repoId: string): Observable<{ synced: number }> {
    return this.http.post<ApiResponse<{ synced: number }>>(`/api/releases/sync/repo/${repoId}`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
