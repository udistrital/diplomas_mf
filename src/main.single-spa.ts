import { enableProdMode, NgZone } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { platformBrowser } from '@angular/platform-browser';
import { Router, NavigationStart } from '@angular/router';
import { provideSingleSpa, provideSingleSpaPlatform, singleSpaAngular } from 'single-spa-angular';

import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

const lifecycles = singleSpaAngular({
  bootstrapFunction: () => {
    const platformRef = platformBrowser(provideSingleSpaPlatform());
    return bootstrapApplication(AppComponent, {
      ...appConfig,
      providers: [...appConfig.providers, provideSingleSpa()]
    }, { platformRef });
  },
  template: '<diplomas-mf />',
  Router,
  NavigationStart,
  NgZone
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;
