# 002 API Contracts

Contratos verificados contra `diplomas_service`.

## Consultar firmante activo

```http
GET /v1/firmantes/rol-activo?documento_identidad={documento}
```

Respuesta exitosa:

```ts
interface FirmanteActivo {
  rol: string;
  orden: number;
  cargo_id: number;
  cargo: string;
  nombre: string;
  documento_identidad: number;
}
```

Errores esperados: 400, 401, 403, 404, 500 y error de red.

## Subir firma de firmante

```http
POST /v1/firmantes/firma
```

Payload real:

```ts
interface SubirFirmaFirmanteRequest {
  documento_identidad_firmante: number;
  IdTipoDocumento?: number;
  nombre?: string;
  descripcion?: string;
  metadatos?: Record<string, unknown>;
  file: string;
}
```

Resultado de referencia:

```ts
interface SubirFirmaFirmanteResult {
  firmante: FirmanteActivo;
  enlace_firma: string;
  documento: Record<string, unknown>;
  firma_firmante: FirmaFirmanteCrudResponse;
}
```

El frontend envia PNG como Base64 sin prefijo data URI para preservar el contrato del backend.
