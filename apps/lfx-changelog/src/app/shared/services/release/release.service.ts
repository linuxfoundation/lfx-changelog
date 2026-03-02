// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type { ApiResponse, StoredRelease } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReleaseService {
  private readonly http = inject(HttpClient);

  public getLatest(limit = 5): Observable<StoredRelease[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<StoredRelease[]>>('/api/releases', { params }).pipe(map((res) => res.data));
  }

  public syncProduct(productId: string): Observable<{ synced: number }> {
    return this.http.post<ApiResponse<{ synced: number }>>(`/api/releases/sync/${productId}`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
