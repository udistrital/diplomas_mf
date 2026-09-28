import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { FirmanteActivo, SubirFirmaFirmanteRequest, SubirFirmaFirmanteResult } from '../models/firmante.model';

export const DIPLOMAS_SERVICE_BASE_URL = new InjectionToken<string>('DIPLOMAS_SERVICE_BASE_URL');

@Injectable({ providedIn: 'root' })
export class DiplomasApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(DIPLOMAS_SERVICE_BASE_URL).replace(/\/$/, '');

  getFirmanteActivo(documento: number): Observable<FirmanteActivo> {
    const params = new HttpParams().set('documento_identidad', String(documento));
    return this.http
      .get<FirmanteActivo>(`${this.baseUrl}/firmantes/rol-activo`, { params })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firmante'))));
  }

  subirFirma(payload: SubirFirmaFirmanteRequest): Observable<SubirFirmaFirmanteResult> {
    return this.http
      .post<SubirFirmaFirmanteResult>(`${this.baseUrl}/firmantes/firma`, payload)
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => this.normalizarError(error, 'firma'))));
  }

  private normalizarError(error: HttpErrorResponse, contexto: 'firmante' | 'firma'): Error {
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
    return new Error('No fue posible procesar la solicitud. Intente nuevamente.');
  }
}
