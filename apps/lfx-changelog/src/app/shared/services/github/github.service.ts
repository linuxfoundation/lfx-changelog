// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { GITHUB_APP_INSTALL_URL } from '@lfx-changelog/shared/constants/github.constant';
import { map, Observable, take } from 'rxjs';

import { environment } from '../../../../environments/environment';

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

  public getInstallUrl(productId: string): string {
    const state = btoa(JSON.stringify({ productId }));
    const baseUrl = environment.production ? '' : 'http://localhost:4204';
    const redirectUrl = `${baseUrl}/webhooks/github-app-callback`;
    return `${GITHUB_APP_INSTALL_URL}?state=${state}&redirect_url=${encodeURIComponent(redirectUrl)}`;
  }
}
