import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DIPLOMAS_SERVICE_BASE_URL, DiplomasApiService } from './diplomas-api.service';

describe('DiplomasApiService', () => {
  let service: DiplomasApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIPLOMAS_SERVICE_BASE_URL, useValue: 'http://diplomas.local/v1' },
        DiplomasApiService
      ]
    });

    service = TestBed.inject(DiplomasApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('TEST-FIRMA-001 consulta correctamente /v1/firmantes/rol-activo', () => {
    service.getFirmanteActivo(10000000).subscribe((firmante) => {
      expect(firmante.nombre).toBe('Ada Lovelace');
      expect(firmante.documento_identidad).toBe(10000000);
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/firmantes/rol-activo?documento_identidad=10000000');
    expect(req.request.method).toBe('GET');
    req.flush({
      rol: 'rector',
      orden: 4,
      cargo_id: 100,
      cargo: 'RECTOR',
      nombre: 'Ada Lovelace',
      documento_identidad: 10000000
    });
  });

  it('TEST-FIRMA-002 envia correctamente POST /v1/firmantes/firma', () => {
    const payload = {
      documento_identidad_firmante: 10000000,
      IdTipoDocumento: 38,
      nombre: 'firma_diploma',
      descripcion: 'firma diploma 2026',
      metadatos: { vigencia: '2026' },
      file: 'BASE64'
    };

    service.subirFirma(payload).subscribe((result) => {
      expect(result.enlace_firma).toBe('uuid-firma');
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/firmantes/firma');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      firmante: {
        rol: 'rector',
        orden: 4,
        cargo_id: 100,
        cargo: 'RECTOR',
        nombre: 'Ada Lovelace',
        documento_identidad: 10000000
      },
      enlace_firma: 'uuid-firma',
      documento: {},
      firma_firmante: {
        id: 1,
        documento_identidad: 10000000,
        enlace_firma: 'uuid-firma',
        activo: true
      }
    });
  });
});
