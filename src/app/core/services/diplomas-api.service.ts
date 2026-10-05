import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { ActualizarCeremoniaRequest, AsignarEstudiantesCeremoniaRequest, AsignarEstudiantesCeremoniaResult, CrearCeremoniaRequest, CrearCeremoniaResult, EstudiantesProgramaCeremoniaResult, QuitarProgramaCeremoniaRequest, TableroCeremoniasResult } from '../models/ceremonia.model';
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
}
