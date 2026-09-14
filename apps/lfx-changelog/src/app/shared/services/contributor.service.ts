// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type {
  ApiResponse,
  ContributorQueryParams,
  ContributorSyncResult,
  ContributorWithRelations,
  PaginatedResponse,
  SlackWorkspaceUser,
  SyncContributorsRequest,
} from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ContributorService {
  private readonly http = inject(HttpClient);

  public getAll(params: ContributorQueryParams = {}): Observable<PaginatedResponse<ContributorWithRelations>> {
    let httpParams = new HttpParams();
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.productId) httpParams = httpParams.set('productId', params.productId);
    if (params.repositoryId) httpParams = httpParams.set('repositoryId', params.repositoryId);
    if (params.slackLink) httpParams = httpParams.set('slackLink', params.slackLink);
    if (params.includeBots) httpParams = httpParams.set('includeBots', 'true');
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.limit) httpParams = httpParams.set('limit', params.limit);

    return this.http.get<PaginatedResponse<ContributorWithRelations>>('/api/contributors', { params: httpParams });
  }

  public getById(id: string): Observable<ContributorWithRelations> {
    return this.http.get<ApiResponse<ContributorWithRelations>>(`/api/contributors/${id}`).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public searchSlackWorkspaceUsers(query: string): Observable<SlackWorkspaceUser[]> {
    return this.http
      .get<ApiResponse<SlackWorkspaceUser[]>>('/api/contributors/slack-users', { params: new HttpParams().set('query', query) })
      .pipe(map((res) => res.data));
  }

  public sync(data: SyncContributorsRequest): Observable<ContributorSyncResult> {
    return this.http.post<ApiResponse<ContributorSyncResult>>('/api/contributors/sync', data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public linkSlack(id: string, slackUserId: string): Observable<ContributorWithRelations> {
    return this.http.put<ApiResponse<ContributorWithRelations>>(`/api/contributors/${id}/slack`, { slackUserId }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public unlinkSlack(id: string): Observable<ContributorWithRelations> {
    return this.http.delete<ApiResponse<ContributorWithRelations>>(`/api/contributors/${id}/slack`).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
