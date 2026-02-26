// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, take } from 'rxjs';

import type { ApiResponse, GitHubInstallation, GitHubRepository } from '@lfx-changelog/shared';
@Injectable({ providedIn: 'root' })
export class GitHubService {
  private readonly http = inject(HttpClient);

  public getInstallations(): Observable<GitHubInstallation[]> {
    return this.http.get<ApiResponse<GitHubInstallation[]>>('/api/github/installations').pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getInstallationRepositories(installationId: number): Observable<GitHubRepository[]> {
    return this.http.get<ApiResponse<GitHubRepository[]>>(`/api/github/installations/${installationId}/repositories`).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getInstallUrl(productId: string): Observable<string> {
    return this.http.get<ApiResponse<string>>(`/api/github/install-url`, { params: { productId } }).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
