# diplomas_mf

Microfrontend Angular para la gestión de diplomas, firmas, ceremonias y registro/control académico.

## Requisitos

- Node.js 20.x o compatible con Angular 21.
- npm.
- Acceso al servicio `diplomas_service` cuando se ejecuten operaciones contra la API.

## Desarrollo local

```bash
npm ci
npm start
```

La aplicación standalone queda disponible en `http://localhost:4227/`. El proxy local redirige `/api` y `/v1` hacia `http://localhost:8090`.

## Verificaciones

```bash
npm test
npm run build
npm run build:single-spa
```

`npm run build` usa la configuración local. `npm run build:test` usa el entorno de pruebas y `npm run build:prod` usa el entorno productivo.

## Integración single-spa

La salida se genera como un bundle UMD para registrarse como `diplomas_mf` en el root-config. La integración expone los lifecycles `bootstrap`, `mount` y `unmount`, usa `APP_BASE_HREF` `/diplomas/` en los builds no locales y conserva `output.publicPath` en `auto`.

El artefacto de producción se genera en `dist/` para que `main.js` y los chunks queden en la raíz publicada que consume el import map de `sga_cliente_root`.

## Entornos

Los endpoints públicos compilados se encuentran en:

- `src/environments/environment.ts`: configuración base/local.
- `src/environments/environment.development.ts`: pruebas.
- `src/environments/environment.production.ts`: producción.

No se almacenan credenciales en el repositorio. Los secretos de Sonar y publicación S3 son responsabilidad de Drone y deben configurarse en el servidor CI.

## CI/CD

`.drone.yml` ejecuta Vitest, builds y análisis Sonar en `feat/*`, `feature/*`, `develop`, `release/*`, `hotfix/*` y `master`. Las pruebas se ejecutan antes de cada build; en `release/*` y `master`, la publicación también depende de que Vitest, el build y Sonar terminen correctamente. Esto incluye la rama actual `feat/integracion-diplomas-mf`.

La publicación S3 sigue el patrón institucional de `reportes_mf` y ocurre automáticamente en cada push de las ramas de release o master:

- `release/*` publica el artefacto de pruebas.
- `master` publica el artefacto productivo.

La fuente de publicación es `dist/**/*` con `target: /${DRONE_REPO_NAME}` y `strip_prefix: dist/`, igual que en `reportes_mf`. Así, `main.js` y cada chunk quedan en la ruta publicada esperada por `sga_cliente_root`.

El pipeline espera estos secretos en Drone:

- `SONAR_HOST`.
- `SONAR_TOKEN`.
- `BUCKET_CLIENTES_TEST`.
- `BUCKET_CLIENTES_PROD`.
- `aws_access_key_id`.
- `aws_secret_access_key`.

Pendiente confirmar con infraestructura: los nombres reales de los buckets, la región, las URLs públicas S3/CloudFront consumidas por el import map de `sga_cliente_root`, y que las credenciales tengan permisos limitados al bucket del repositorio.

La cobertura Vitest no se genera actualmente porque `@vitest/coverage-v8` no está instalado. No se agregó dependencia ni se modificó el lockfile.
