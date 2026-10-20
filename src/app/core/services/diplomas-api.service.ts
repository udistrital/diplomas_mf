import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { ActualizarCeremoniaRequest, AnularFirmaDiplomaRequest, AnularFirmaDiplomaResult, AsignarEstudiantesCeremoniaRequest, AsignarEstudiantesCeremoniaResult, CrearCeremoniaRequest, CrearCeremoniaResult, CeremoniaFirmasResult, DiplomaPreviewResult, EstudiantesProgramaCeremoniaResult, FirmaMasivaCeremoniaRequest, FirmaMasivaCeremoniaResult, GuardarParametrizacionRegistroRequest, ParametrizacionRegistro, QuitarProgramaCeremoniaRequest, RegistroControlCatalogo, TableroCeremoniasResult } from '../models/ceremonia.model';
import { FirmanteActivo, SubirFirmaFirmanteRequest, SubirFirmaFirmanteResult } from '../models/firmante.model';

export const DIPLOMAS_SERVICE_BASE_URL = new InjectionToken<string>('DIPLOMAS_SERVICE_BASE_URL');

@Injectable({ providedIn: 'root' })
export class DiplomasApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(DIPLOMAS_SERVICE_BASE_URL).replace(/\/$/, '');

  getFirmanteActivo(documento: number): Observable<FirmanteActivo> {
    const params = new HttpParams().set('documento_identidad', String(documento));
    return this.http
      .get<FirmanteActivo>(`${this.baseUrl}/firmantes/rol-activo`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firmante'))));
  }

  subirFirma(payload: SubirFirmaFirmanteRequest): Observable<SubirFirmaFirmanteResult> {
    return this.http
      .post<SubirFirmaFirmanteResult>(`${this.baseUrl}/firmantes/firma`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  getTableroCeremonias(documento: number): Observable<TableroCeremoniasResult> {
    const params = new HttpParams().set('documento_identidad_secretario', String(documento));
    return this.http
      .get<TableroCeremoniasResult>(`${this.baseUrl}/ceremonias`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  getParametrizacionRegistro(documento: number, vigencia: number): Observable<ParametrizacionRegistro> {
    const params = new HttpParams().set('documento_identidad_secretario', String(documento)).set('vigencia', String(vigencia));
    return this.http
      .get<ParametrizacionRegistro>(`${this.baseUrl}/ceremonias/parametrizacion-registro`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  guardarParametrizacionRegistro(payload: GuardarParametrizacionRegistroRequest): Observable<ParametrizacionRegistro> {
    return this.http
      .post<ParametrizacionRegistro>(`${this.baseUrl}/ceremonias/parametrizacion-registro`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  getTableroCeremoniasDecano(documento: number): Observable<TableroCeremoniasResult> {
    const params = new HttpParams().set('documento_identidad_decano', String(documento));
    return this.http
      .get<TableroCeremoniasResult>(`${this.baseUrl}/ceremonias/decano`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  getTableroCeremoniasSecretariaGeneral(documento: number): Observable<TableroCeremoniasResult> {
    const params = new HttpParams().set('documento_identidad_firmante', String(documento));
    return this.http
      .get<TableroCeremoniasResult>(`${this.baseUrl}/ceremonias/secretaria-general`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  getTableroCeremoniasRector(documento: number): Observable<TableroCeremoniasResult> {
    const params = new HttpParams().set('documento_identidad_firmante', String(documento));
    return this.http
      .get<TableroCeremoniasResult>(`${this.baseUrl}/ceremonias/rector`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  actualizarCeremonia(id: number, payload: ActualizarCeremoniaRequest): Observable<unknown> {
    return this.http
      .put(`${this.baseUrl}/ceremonias/${id}`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  eliminarCeremonia(id: number, documento: number): Observable<unknown> {
    const params = new HttpParams().set('documento_identidad_secretario', String(documento));
    return this.http
      .delete(`${this.baseUrl}/ceremonias/${id}`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  asignarEstudiantesCeremonia(id: number, payload: AsignarEstudiantesCeremoniaRequest): Observable<AsignarEstudiantesCeremoniaResult> {
    return this.http
      .post<AsignarEstudiantesCeremoniaResult>(`${this.baseUrl}/ceremonias/${id}/asignar`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  quitarProgramaCeremonia(id: number, payload: QuitarProgramaCeremoniaRequest): Observable<AsignarEstudiantesCeremoniaResult> {
    return this.http
      .delete<AsignarEstudiantesCeremoniaResult>(`${this.baseUrl}/ceremonias/${id}/programa`, { body: payload, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  getEstudiantesProgramaCeremonia(programaId: number, documento: number): Observable<EstudiantesProgramaCeremoniaResult> {
    const params = new HttpParams().set('documento_identidad_secretario', String(documento));
    return this.http
      .get<EstudiantesProgramaCeremoniaResult>(`${this.baseUrl}/ceremonias/programas/${programaId}/estudiantes`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  getFirmasCeremonia(id: number, documento: number): Observable<CeremoniaFirmasResult> {
    const params = new HttpParams().set('documento_identidad_secretario', String(documento));
    return this.http
      .get<CeremoniaFirmasResult>(`${this.baseUrl}/ceremonias/${id}/firmas`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  firmarCeremonia(id: number, payload: FirmaMasivaCeremoniaRequest): Observable<FirmaMasivaCeremoniaResult> {
    return this.http
      .post<FirmaMasivaCeremoniaResult>(`${this.baseUrl}/ceremonias/${id}/firmas`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  getFirmasCeremoniaDecano(id: number, documento: number): Observable<CeremoniaFirmasResult> {
    const params = new HttpParams().set('documento_identidad_decano', String(documento));
    return this.http
      .get<CeremoniaFirmasResult>(`${this.baseUrl}/ceremonias/${id}/firmas-decano`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  firmarCeremoniaDecano(id: number, payload: FirmaMasivaCeremoniaRequest): Observable<FirmaMasivaCeremoniaResult> {
    return this.http
      .post<FirmaMasivaCeremoniaResult>(`${this.baseUrl}/ceremonias/${id}/firmas-decano`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  getFirmasCeremoniaSecretariaGeneral(id: number, documento: number): Observable<CeremoniaFirmasResult> {
    const params = new HttpParams().set('documento_identidad_firmante', String(documento));
    return this.http
      .get<CeremoniaFirmasResult>(`${this.baseUrl}/ceremonias/${id}/firmas-secretaria-general`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  firmarCeremoniaSecretariaGeneral(id: number, payload: FirmaMasivaCeremoniaRequest): Observable<FirmaMasivaCeremoniaResult> {
    return this.http
      .post<FirmaMasivaCeremoniaResult>(`${this.baseUrl}/ceremonias/${id}/firmas-secretaria-general`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  getFirmasCeremoniaRector(id: number, documento: number): Observable<CeremoniaFirmasResult> {
    const params = new HttpParams().set('documento_identidad_firmante', String(documento));
    return this.http
      .get<CeremoniaFirmasResult>(`${this.baseUrl}/ceremonias/${id}/firmas-rector`, { params, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  firmarCeremoniaRector(id: number, payload: FirmaMasivaCeremoniaRequest): Observable<FirmaMasivaCeremoniaResult> {
    return this.http
      .post<FirmaMasivaCeremoniaResult>(`${this.baseUrl}/ceremonias/${id}/firmas-rector`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  getDiplomaPreview(documentoDigitalId: number): Observable<DiplomaPreviewResult> {
    return this.http
      .get<DiplomaPreviewResult>(`${this.baseUrl}/documento_digital/${documentoDigitalId}/diploma/preview`, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  descargarDiplomasRegistroControl(facultadId?: number, ceremoniaId?: number): Observable<Blob> {
    let params = new HttpParams();
    if (facultadId) {
      params = params.set('facultad_id', String(facultadId));
    }
    if (ceremoniaId) {
      params = params.set('ceremonia_id', String(ceremoniaId));
    }
    return this.http.get(`${this.baseUrl}/diplomas/registro-control/archivo`, {
      params,
      headers: this.authHeaders(),
      responseType: 'blob'
    });
  }

  getOpcionesRegistroControl(): Observable<RegistroControlCatalogo> {
    return this.http.get<RegistroControlCatalogo>(`${this.baseUrl}/diplomas/registro-control/opciones`, {
      headers: this.authHeaders()
    });
  }

  anularFirmaDocumento(documentoDigitalId: number, payload: AnularFirmaDiplomaRequest): Observable<AnularFirmaDiplomaResult> {
    return this.http
      .delete<AnularFirmaDiplomaResult>(`${this.baseUrl}/documento_digital/${documentoDigitalId}/firma`, { body: payload, headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  crearCeremonia(payload: CrearCeremoniaRequest): Observable<CrearCeremoniaResult> {
    return this.http
      .post<CrearCeremoniaResult>(`${this.baseUrl}/ceremonias`, payload, { headers: this.authHeaders() })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'ceremonia'))));
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private normalizarError(error: HttpErrorResponse, contexto: 'firmante' | 'firma' | 'ceremonia'): Error {
    if (error.status === 0) {
      return new Error('No fue posible conectar con diplomas_service. Verifique la red e intente nuevamente.');
    }
    const detalle = this.extraerDetalleError(error);
    if (detalle) {
      return new Error(detalle);
    }
    if (contexto === 'firmante' && (error.status === 404 || error.status === 422 || error.status === 500)) {
      return new Error('No se encontró un firmante activo para el documento ingresado.');
    }
    if (error.status === 401 || error.status === 403) {
      return new Error('No tiene permisos para realizar esta acción.');
    }
    if (contexto === 'firma') {
      return new Error('No fue posible cargar la firma. Intente nuevamente.');
    }
    if (contexto === 'ceremonia') {
      return new Error('No fue posible registrar la ceremonia. Revise los datos e intente nuevamente.');
    }
    return new Error('No fue posible procesar la solicitud. Intente nuevamente.');
  }

  private extraerDetalleError(error: HttpErrorResponse): string | null {
    if (!error.error) {
      return null;
    }
    if (typeof error.error === 'string') {
      return error.error;
    }
    const body = error.error as Record<string, unknown>;
    const mensaje = body['message'] || body['Message'] || body['error'] || body['Error'] || body['Status'];
    if (typeof mensaje === 'string' && mensaje.trim()) {
      return mensaje;
    }
    const resultados = body['resultados'];
    if (Array.isArray(resultados)) {
      const errores = resultados
        .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>)['error'] : null))
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      if (errores.length > 0) {
        return [...new Set(errores)].join(' ');
      }
    }
    return null;
  }
}
