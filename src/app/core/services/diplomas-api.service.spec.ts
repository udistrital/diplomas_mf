import { environment as localEnvironment } from '../../../environments/environment.local';
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

  it('envia correctamente POST /v1/ceremonias', () => {
    const payload = {
      periodo_id: 77,
      fecha_ceremonia: '2026-11-20',
      lugar: 'Auditorio Mayor',
      cantidad_estudiantes_programada: 40,
      observacion: 'Ceremonia ordinaria',
      documento_identidad_secretario: 1023026828
    };

    service.crearCeremonia(payload).subscribe((result) => {
      expect(result.ceremonia.id).toBe(99);
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/ceremonias');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ceremonia: { id: 99, lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, activo: true }, facultad: { id: 100, facultad_id: 158, programa_academico_id: 0, activo: true }, secretario_academico: { rol: 'secretario_academico', orden: 1, cargo_id: 158, cargo: 'SECRETARIO ACADEMICO', nombre: 'Secretaria', documento_identidad: 1023026828 } });
  });

  it('consulta estudiantes asignados para firma por ceremonia', () => {
    service.getFirmasCeremonia(77, 1023026828).subscribe((result) => {
      expect(result.ceremonia.id).toBe(77);
      expect(result.estudiantes.length).toBe(1);
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/ceremonias/77/firmas?documento_identidad_secretario=1023026828');
    expect(req.request.method).toBe('GET');
    req.flush({
      ceremonia: { id: 77, relacion_id: 88, facultad_id: 14, fecha_ceremonia: '2026-11-30T00:00:00Z', lugar: 'Auditorio', cantidad_estudiantes_programada: 30, cupos_asignados: 1, cupos_disponibles: 29, activo: true },
      total: 1,
      firmados: 0,
      pendientes: 1,
      estudiantes: [{ asignacion_id: 1, documento_digital_id: 55, codigo_estudiante: 20161020507, estado_documento_id: 1, firma_secretario: false, puede_firmar: true }]
    });
  });

  it('envia firma masiva de ceremonia', () => {
    const payload = { documento_identidad_secretario: 1023026828, documento_digital_ids: [55, 56] };

    service.firmarCeremonia(77, payload).subscribe((result) => {
      expect(result.firmados).toBe(2);
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/ceremonias/77/firmas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ceremonia_id: 77, total: 2, firmados: 2, omitidos: 0, errores: 0, resultados: [] });
  });

  it('prepara el registro con POST antes del preview del secretario', () => {
    service.prepararDiplomaPreview(55,123).subscribe();
    const req = httpMock.expectOne('http://diplomas.local/v1/documento_digital/55/diploma/preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({documento_identidad_secretario:123});
    req.flush({preview:true,documento_id:55,metadatos:{},file:'PDF_BASE64'});
  });

  it('consulta preview de diploma por documento digital', () => {
    service.getDiplomaPreview(55).subscribe((result) => {
      expect(result.documento_id).toBe(55);
      expect(result.file).toBe('PDF_BASE64');
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/documento_digital/55/diploma/preview');
    expect(req.request.method).toBe('GET');
    req.flush({ preview: true, documento_id: 55, tipo_documento: 'DIPLOMA', metadatos: { nombre_estudiante: 'Ada' }, file: 'PDF_BASE64' });
  });

  it('descarga ZIP original filtrado por facultad y ceremonia', () => {
    service.descargarDiplomasRegistroControl(14, 4).subscribe((archivo) => {
      expect(archivo.type).toBe('application/zip');
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/diplomas/registro-control/archivo?facultad_id=14&ceremonia_id=4');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['ZIP'], { type: 'application/zip' }));
  });

  it('consulta facultades y ceremonias disponibles para registro y control', () => {
    service.getOpcionesRegistroControl().subscribe((catalogo) => {
      expect(catalogo.facultades[0].nombre).toBe('Facultad de Ingeniería');
      expect(catalogo.facultades[0].ceremonias[0].diplomas_disponibles).toBe(12);
    });

    const req = httpMock.expectOne('http://diplomas.local/v1/diplomas/registro-control/opciones');
    expect(req.request.method).toBe('GET');
    req.flush({
      facultades: [{
        id: 14,
        nombre: 'Facultad de Ingeniería',
        ceremonias: [{ id: 4, fecha: '2026-10-08T00:00:00Z', lugar: 'Auditorio', diplomas_disponibles: 12 }]
      }]
    });
  });

  it('no muestra HTML del proxy como mensaje al validar firmante', () => {
    let mensaje = '';
    service.getFirmanteActivo(123).subscribe({error: error => mensaje = error.message});
    httpMock.expectOne('http://diplomas.local/v1/firmantes/rol-activo?documento_identidad=123')
      .flush('<!DOCTYPE html><pre>Cannot GET /v1/firmantes/rol-activo</pre>', {status:404,statusText:'Not Found'});
    expect(mensaje).not.toContain('<');
    expect(mensaje).toContain('firmante activo');
  });

});


describe('API local montada por root en otro puerto', () => {
 it('envía llamadas a proxy 4227 y evita resolver /v1 contra root 4200', () => {
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:DIPLOMAS_SERVICE_BASE_URL,useValue:localEnvironment.DIPLOMAS_SERVICE.BASE_URL}]});
  const api=TestBed.inject(DiplomasApiService);
  const http=TestBed.inject(HttpTestingController);
  api.getFirmanteActivo(123).subscribe();
  const request=http.expectOne('http://localhost:4227/v1/firmantes/rol-activo?documento_identidad=123');
  expect(new URL(request.request.url).port).toBe('4227');
  request.flush({});http.verify();
 });
});
