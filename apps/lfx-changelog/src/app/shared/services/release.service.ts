// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type {
  ApiResponse,
  CreateReleaseRequest,
  GeneratedReleaseNotes,
  GitHubRelease,
  ReleaseChanges,
  ReleaseTarget,
  RepositoryWithCounts,
  StoredRelease,
} from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReleaseService {
  private readonly http = inject(HttpClient);

  public getLatest(limit = 5): Observable<StoredRelease[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<StoredRelease[]>>('/api/github/releases', { params }).pipe(map((res) => res.data));
  }

  public getReleasesForRepository(repoId: string, limit = 50): Observable<StoredRelease[]> {
    const params = new HttpParams().set('repositoryId', repoId).set('limit', limit.toString());
    return this.http.get<ApiResponse<StoredRelease[]>>('/api/github/releases', { params }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getRepositories(): Observable<RepositoryWithCounts[]> {
    return this.http.get<ApiResponse<RepositoryWithCounts[]>>('/api/github/repositories').pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public syncProduct(productId: string): Observable<{ synced: number }> {
    return this.http.post<ApiResponse<{ synced: number }>>(`/api/github/products/${productId}/sync`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public syncRepository(repoId: string): Observable<{ synced: number }> {
    return this.http.post<ApiResponse<{ synced: number }>>(`/api/github/repositories/${repoId}/sync`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getReleaseTarget(repoId: string): Observable<ReleaseTarget> {
    return this.http.get<ApiResponse<ReleaseTarget>>(`/api/github/repositories/${repoId}/release-target`).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getChanges(repoId: string, targetCommitish: string): Observable<ReleaseChanges> {
    const params = new HttpParams().set('targetCommitish', targetCommitish);
    return this.http.get<ApiResponse<ReleaseChanges>>(`/api/github/repositories/${repoId}/changes`, { params }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public previewNotes(repoId: string, tagName: string, targetCommitish: string): Observable<GeneratedReleaseNotes> {
    return this.http.post<ApiResponse<GeneratedReleaseNotes>>(`/api/github/repositories/${repoId}/release-notes`, { tagName, targetCommitish }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public createRelease(repoId: string, data: CreateReleaseRequest): Observable<GitHubRelease> {
    return this.http.post<ApiResponse<GitHubRelease>>(`/api/github/repositories/${repoId}/releases`, data).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
