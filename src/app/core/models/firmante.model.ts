export interface FirmanteActivo {
  rol: string;
  orden: number;
  cargo_id: number;
  cargo: string;
  nombre: string;
  documento_identidad: number;
}

export interface SubirFirmaFirmanteRequest {
  documento_identidad_firmante: number;
  IdTipoDocumento?: number;
  nombre?: string;
  descripcion?: string;
  metadatos?: Record<string, unknown>;
  file: string;
}

export interface FirmaFirmanteCrudResponse {
  id: number;
  documento_identidad: number;
  enlace_firma: string;
  activo: boolean;
}

export interface SubirFirmaFirmanteResult {
  firmante: FirmanteActivo;
  enlace_firma: string;
  documento: Record<string, unknown>;
  firma_firmante: FirmaFirmanteCrudResponse;
}
