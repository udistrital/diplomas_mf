# 001 Architecture

## Stack

- Angular 21.2.x
- TypeScript 5.9.x
- RxJS 7.8.x
- single-spa-angular 21.x
- ngx-translate
- Vitest
- SCSS
- npm

## Microfrontend

- Nombre: `diplomas_mf`
- Selector: `diplomas-mf`
- Base href: `/diplomas/`
- Ruta inicial: `/diplomas/firmas`
- Puerto local: `4210`

## Capas

- `core/models`: DTOs estrictos.
- `core/services`: fachada HTTP hacia `diplomas_service`.
- `core/guards`: guard compatible con carga desde Core.
- `features/firmas`: primera vertical funcional.

## Regla de integracion

El microfrontend consume solamente `diplomas_service`. No hay llamadas directas a `diplomas_crud`.

## Single-SPA

El proyecto incluye `main.single-spa.ts` y `custom-webpack.config.js`. El build standalone usa `main.ts`; el build Single-SPA usa configuracion `single-spa`.
