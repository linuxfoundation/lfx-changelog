import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions, withIncrementalHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { authenticationInterceptor } from '@shared/interceptors/authentication.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideClientHydration(withEventReplay(), withIncrementalHydration(), withHttpTransferCacheOptions({ includeHeaders: ['Authorization'] })),
    provideHttpClient(withFetch(), withInterceptors([authenticationInterceptor])),
  ],
};
