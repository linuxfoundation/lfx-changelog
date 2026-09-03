// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take, takeWhile } from 'rxjs';

import { SseService } from './sse.service';

import type { ApiResponse, PaginatedResponse, ReleaseJob, ReleaseJobQueryParams, ReleaseJobSSEEvent, ReleaseJobSSEEventType } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReleaseJobService {
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SseService);

  public list(params?: Partial<ReleaseJobQueryParams>): Observable<PaginatedResponse<ReleaseJob>> {
    return this.http.get<PaginatedResponse<ReleaseJob>>('/api/release-jobs', { params: this.buildParams(params) });
  }

  public getById(id: string): Observable<ReleaseJob> {
    return this.http.get<ApiResponse<ReleaseJob>>(`/api/release-jobs/${id}`).pipe(map((res) => res.data));
  }

  public start(serviceKey: string, notes: string, newTag?: string, headSha?: string | null): Observable<ReleaseJob> {
    return this.http.post<ApiResponse<ReleaseJob>>('/api/release-jobs', { serviceKey, notes, newTag, headSha }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public cancel(id: string): Observable<ReleaseJob> {
    return this.http.post<ApiResponse<ReleaseJob>>(`/api/release-jobs/${id}/cancel`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public retry(id: string): Observable<ReleaseJob> {
    return this.http.post<ApiResponse<ReleaseJob>>(`/api/release-jobs/${id}/retry`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public refreshSync(id: string): Observable<ReleaseJob> {
    return this.http.post<ApiResponse<ReleaseJob>>(`/api/release-jobs/${id}/refresh-sync`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public streamJob(id: string): Observable<ReleaseJobSSEEvent> {
    return this.sseService.connect<ReleaseJobSSEEventType>(`/api/release-jobs/${id}/stream`).pipe(
      map((event) => event as ReleaseJobSSEEvent),
      takeWhile((event) => event.type !== 'done', true)
    );
  }

  private buildParams(params?: Partial<ReleaseJobQueryParams>): HttpParams {
    let httpParams = new HttpParams();
    if (params?.serviceKey) httpParams = httpParams.set('serviceKey', params.serviceKey);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return httpParams;
  }
}
