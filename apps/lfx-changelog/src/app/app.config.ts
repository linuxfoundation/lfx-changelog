// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions, withIncrementalHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { authenticationInterceptor } from '@shared/interceptors/authentication.interceptor';
import { provideDataDogRum } from '@shared/providers/datadog-rum/datadog-rum.provider';
import { provideRuntimeConfig } from '@shared/providers/runtime-config/runtime-config.provider';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideClientHydration(withEventReplay(), withIncrementalHydration(), withHttpTransferCacheOptions({ includeHeaders: ['Authorization'] })),
    provideHttpClient(withFetch(), withInterceptors([authenticationInterceptor])),
    provideRuntimeConfig(),
    provideDataDogRum(),
  ],
};
