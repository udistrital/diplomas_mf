import { OverlayContainer } from '@angular/cdk/overlay';
import { APP_BASE_HREF } from '@angular/common';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, inject, provideEnvironmentInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { environment } from '../environments/environment';
import { DIPLOMAS_SERVICE_BASE_URL } from './core/services/diplomas-api.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      inject(OverlayContainer).getContainerElement().classList.add('diplomas-overlay');
    }),
    { provide: APP_BASE_HREF, useValue: '/diplomas/' },
    { provide: DIPLOMAS_SERVICE_BASE_URL, useValue: environment.DIPLOMAS_SERVICE.BASE_URL },
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideTranslateService({ lang: 'es', fallbackLang: 'es' })
  ]
};
