// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take, takeWhile } from 'rxjs';

import { SseService } from './sse.service';

import type {
  AgentJobDetail,
  AgentJobQueryParams,
  AgentJobSSEEvent,
  AgentJobSSEEventType,
  AgentJobWithProduct,
  ApiResponse,
  PaginatedResponse,
} from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AgentJobService {
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SseService);

  public getAll(params?: Partial<AgentJobQueryParams>): Observable<PaginatedResponse<AgentJobWithProduct>> {
    return this.http.get<PaginatedResponse<AgentJobWithProduct>>('/api/agent-jobs', { params: this.buildParams(params) });
  }

  public getById(id: string): Observable<AgentJobDetail> {
    return this.http.get<ApiResponse<AgentJobDetail>>(`/api/agent-jobs/${id}`).pipe(map((res) => res.data));
  }

  public trigger(productId: string): Observable<{ jobId: string }> {
    return this.http.post<ApiResponse<{ jobId: string }>>(`/api/agent-jobs/trigger/${productId}`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public triggerBlog(type: string, params?: { year?: number; month?: number }): Observable<{ jobId: string }> {
    let httpParams = new HttpParams();
    if (params?.year) httpParams = httpParams.set('year', params.year.toString());
    if (params?.month) httpParams = httpParams.set('month', params.month.toString());
    return this.http.post<ApiResponse<{ jobId: string }>>(`/api/agent-jobs/trigger-blog/${type}`, {}, { params: httpParams }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public cancel(id: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`/api/agent-jobs/${id}/cancel`, {}).pipe(take(1));
  }

  public streamJob(id: string): Observable<AgentJobSSEEvent> {
    return this.sseService.connect<AgentJobSSEEventType>(`/api/agent-jobs/${id}/stream`).pipe(
      map((event) => event as AgentJobSSEEvent),
      takeWhile((event) => event.type !== 'done', true)
    );
  }

  private buildParams(params?: Partial<AgentJobQueryParams>): HttpParams {
    let httpParams = new HttpParams();
    if (params?.productId) httpParams = httpParams.set('productId', params.productId);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return httpParams;
  }
}
