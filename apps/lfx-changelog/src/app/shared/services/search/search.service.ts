// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import type { SearchQueryParamsInput, SearchResponse } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  public search(params: SearchQueryParamsInput): Observable<SearchResponse> {
    let httpParams = new HttpParams().set('q', params.q);
    if (params.productId) httpParams = httpParams.set('productId', params.productId);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<SearchResponse>('/public/api/changelogs/search', { params: httpParams });
  }
}
