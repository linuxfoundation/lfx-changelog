// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import type { ApiResponse, RoadmapBoardResponse, RoadmapComment, RoadmapIdea } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RoadmapService {
  private readonly http = inject(HttpClient);

  public getBoard(team?: string, includeCompleted = false): Observable<RoadmapBoardResponse> {
    let params = new HttpParams();
    if (team) params = params.set('team', team);
    if (includeCompleted) params = params.set('includeCompleted', 'true');
    return this.http.get<ApiResponse<RoadmapBoardResponse>>('/public/api/roadmap', { params }).pipe(map((res) => res.data));
  }

  public getIdea(jiraKey: string): Observable<RoadmapIdea> {
    return this.http.get<ApiResponse<RoadmapIdea>>(`/public/api/roadmap/${jiraKey}`).pipe(map((res) => res.data));
  }

  public getComments(jiraKey: string): Observable<RoadmapComment[]> {
    return this.http.get<ApiResponse<RoadmapComment[]>>(`/public/api/roadmap/${jiraKey}/comments`).pipe(map((res) => res.data));
  }
}
