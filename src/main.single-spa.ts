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

const domElementGetter = (): HTMLElement => {
  const containerId = 'single-spa-application:@udistrital/diplomas-mf';
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  return container;
};

const lifecycles = singleSpaAngular({
  bootstrapFunction: () => {
    const platformRef = platformBrowser(provideSingleSpaPlatform());
    return bootstrapApplication(AppComponent, {
      ...appConfig,
      providers: [...appConfig.providers, provideSingleSpa()]
    }, { platformRef });
  },
  template: '<diplomas-mf></diplomas-mf>',
  domElementGetter,
  Router,
  NavigationStart,
  NgZone
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;
