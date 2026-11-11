import { enableProdMode } from '@angular/core';
import { bootstrapApplication, platformBrowser } from '@angular/platform-browser';
import { NavigationStart, Router } from '@angular/router';
import type { AppProps, LifeCycleFn } from 'single-spa';
import { provideSingleSpa, provideSingleSpaPlatform, singleSpaAngular } from 'single-spa-angular';

import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

const lifecycles = singleSpaAngular({
  bootstrapFunction: async () => {
    const platformRef = platformBrowser(provideSingleSpaPlatform());
    const application = await bootstrapApplication(AppComponent, {
      ...appConfig,
      providers: [...appConfig.providers, provideSingleSpa()]
    }, { platformRef });
    return application;
  },
  template: '<diplomas-mf></diplomas-mf>',
  Router,
  NavigationStart,
  // Angular 21 uses zoneless change detection. The legacy core owns Zone.js.
  NgZone: 'noop'
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;

// The same local server remains usable directly, without starting a second app
// when the SGA loads this module. single-spa installs this marker before loadApp.
if (!(window as Window & { singleSpaNavigate?: unknown }).singleSpaNavigate) {
  void import('./main');
}
