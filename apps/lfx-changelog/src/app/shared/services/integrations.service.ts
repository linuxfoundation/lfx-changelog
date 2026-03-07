// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type { ApiResponse, GitHubInstallation, GitHubRepository, PostToSlackResponse, SlackChannel, SlackChannelOption, SlackIntegration } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IntegrationsService {
  private readonly http = inject(HttpClient);

  // ── GitHub ──────────────────────────────────────

  public getGitHubInstallations(): Observable<GitHubInstallation[]> {
    return this.http.get<ApiResponse<GitHubInstallation[]>>('/api/github/installations').pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getGitHubInstallationRepositories(installationId: number): Observable<GitHubRepository[]> {
    return this.http.get<ApiResponse<GitHubRepository[]>>(`/api/github/installations/${installationId}/repositories`).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public getGitHubInstallUrl(productId: string): Observable<string> {
    return this.http.get<ApiResponse<string>>('/api/github/install-url', { params: { productId } }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  // ── Slack ───────────────────────────────────────

  public getSlackIntegrations(): Observable<SlackIntegration[]> {
    return this.http.get<ApiResponse<SlackIntegration[]>>('/api/slack/integrations').pipe(map((res) => res.data));
  }

  public getSlackChannels(integrationId: string): Observable<SlackChannelOption[]> {
    return this.http.get<ApiResponse<SlackChannelOption[]>>(`/api/slack/integrations/${integrationId}/channels`).pipe(map((res) => res.data));
  }

  public saveSlackChannel(integrationId: string, channelId: string, channelName: string): Observable<SlackChannel> {
    return this.http.post<ApiResponse<SlackChannel>>(`/api/slack/integrations/${integrationId}/channels`, { channelId, channelName }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public disconnectSlack(integrationId: string): Observable<void> {
    return this.http.delete<void>(`/api/slack/integrations/${integrationId}`).pipe(take(1));
  }

  public postToSlack(changelogId: string, channelId: string, channelName: string): Observable<PostToSlackResponse> {
    return this.http.post<ApiResponse<PostToSlackResponse>>(`/api/changelogs/${changelogId}/share/slack`, { channelId, channelName }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public connectSlack(): void {
    this.http
      .get<ApiResponse<{ url: string }>>('/api/slack/connect')
      .pipe(
        map((res) => res.data.url),
        take(1)
      )
      .subscribe((url) => {
        window.location.href = url;
      });
  }
}
