// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type { ApiResponse, PostToSlackResponse, SlackChannel, SlackChannelOption, SlackIntegration } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SlackService {
  private readonly http = inject(HttpClient);

  public getIntegrations(): Observable<SlackIntegration[]> {
    return this.http.get<ApiResponse<SlackIntegration[]>>('/api/slack/integrations').pipe(map((res) => res.data));
  }

  public getChannels(integrationId: string): Observable<SlackChannelOption[]> {
    return this.http.get<ApiResponse<SlackChannelOption[]>>(`/api/slack/integrations/${integrationId}/channels`).pipe(map((res) => res.data));
  }

  public saveChannel(integrationId: string, channelId: string, channelName: string): Observable<SlackChannel> {
    return this.http.post<ApiResponse<SlackChannel>>(`/api/slack/integrations/${integrationId}/channels`, { channelId, channelName }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public disconnect(integrationId: string): Observable<void> {
    return this.http.delete<void>(`/api/slack/integrations/${integrationId}`).pipe(take(1));
  }

  public postToSlack(changelogId: string, channelId: string, channelName: string): Observable<PostToSlackResponse> {
    return this.http.post<ApiResponse<PostToSlackResponse>>(`/api/changelogs/${changelogId}/share/slack`, { channelId, channelName }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public connect(): void {
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
