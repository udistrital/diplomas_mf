import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Swal from 'sweetalert2';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiplomasApiService } from '../../core/services/diplomas-api.service';
import { FirmaSecretarioComponent } from './firma-secretario';

const ceremonia = {
  id: 4,
  cupos_asignados: 1,
  fecha_ceremonia: '2026-10-08'
};

const resultado = {
  ceremonia_id: 4,
  total: 1,
  firmados: 1,
  omitidos: 0,
  errores: 0,
  resultados: [{ documento_digital_id: 40, firmado: true }]
};

class DiplomasApiServiceMock {
  getDiplomaPreview = vi.fn(() => of({preview:true,documento_id:40,tipo_documento:'diploma',metadatos:{},file:btoa('%PDF-1.4\n')}));
  firmarCeremoniaRector = vi.fn(() => of(resultado));
  getFirmasCeremoniaRector = vi.fn(() => of({
    ceremonia,
    total: 1,
    firmados: 1,
    pendientes: 0,
    estudiantes: []
  }));
  getFirmanteActivo = vi.fn(() => of({
    rol: 'rector',
    orden: 4,
    cargo_id: 100,
    cargo: 'RECTOR',
    nombre: 'Rector Prueba',
    documento_identidad: 123,
    enlace_firma: 'firma'
  }));
  getTableroCeremoniasRector = vi.fn(() => of({ ceremonias: [ceremonia] }));
}

describe('FirmaSecretarioComponent en modo rector', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => {
      const cleanUrl = url.replace(/^\.\//, '');
      return readFile(join(process.cwd(), 'src/app/features/firma-secretario', cleanUrl), 'utf-8');
    });
  });

  let component: FirmaSecretarioComponent;
  let api: DiplomasApiServiceMock;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('user', btoa(JSON.stringify({ userService: { documento: 123 } })));

    await TestBed.configureTestingModule({
      imports: [FirmaSecretarioComponent],
      providers: [
        { provide: DiplomasApiService, useClass: DiplomasApiServiceMock },
        { provide: Router, useValue: { url: '/diplomas/firma-rector' } },
        { provide: DomSanitizer, useValue: { bypassSecurityTrustResourceUrl: vi.fn((value) => value) } }
      ]
    }).compileComponents();

    component = TestBed.createComponent(FirmaSecretarioComponent).componentInstance;
    api = TestBed.inject(DiplomasApiService) as unknown as DiplomasApiServiceMock;
    component.firmante.set({
      rol: 'rector',
      orden: 4,
      cargo_id: 100,
      cargo: 'RECTOR',
      nombre: 'Rector Prueba',
      documento_identidad: 123,
      enlace_firma: 'firma'
    });
    component.ceremoniaSeleccionada.set(ceremonia as never);
    component.seleccionados.set(new Set([40]));
  });

  afterEach(() => {
    component.cerrarPreview();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('muestra PDF mediante blob y libera URL al cerrar', async () => {
    const create = vi.fn((_blob: Blob) => 'blob:http://localhost/diploma');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    });
    await component.abrirPreview({documento_digital_id:40} as never);
    const blob = create.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBe('%PDF-1.4\n'.length);
    expect(component.previewUrl()).toBe('blob:http://localhost/diploma');
    component.cerrarPreview();
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/diploma');
    expect(component.previewUrl()).toBeNull();
  });

  it('ignora la respuesta si el modal se cerró durante la carga', async () => {
    const respuesta = new Subject<ReturnType<typeof api.getDiplomaPreview> extends import('rxjs').Observable<infer T> ? T : never>();
    api.getDiplomaPreview.mockReturnValueOnce(respuesta);
    const pendiente = component.abrirPreview({documento_digital_id:40} as never);
    component.cerrarPreview();
    respuesta.next({preview:true,documento_id:40,tipo_documento:'diploma',metadatos:{},file:btoa('%PDF-1.4')});
    await pendiente;
    expect(component.previewUrl()).toBeNull();
    expect(component.previewAbierto()).toBe(false);
  });

  it('cierra el estado de procesamiento antes de mostrar el resultado y actualiza el tablero', async () => {
    const fire = vi.spyOn(Swal, 'fire')
      .mockResolvedValueOnce({ isConfirmed: true } as never)
      .mockImplementationOnce(async () => {
        expect(component.procesando()).toBe(false);
        return { isConfirmed: true } as never;
      });

    await component.firmarSeleccionados();

    expect(api.firmarCeremoniaRector).toHaveBeenCalledOnce();
    expect(api.getFirmasCeremoniaRector).toHaveBeenCalled();
    expect(api.getTableroCeremoniasRector).toHaveBeenCalled();
    expect(component.procesando()).toBe(false);
    expect(fire).toHaveBeenCalledTimes(2);
  });

  it.each([409, 500])('cierra el estado de procesamiento tras HTTP %s', async (status) => {
    api.firmarCeremoniaRector.mockReturnValueOnce(
      throwError(() => new Error(`HTTP ${status}`))
    );
    const fire = vi.spyOn(Swal, 'fire')
      .mockResolvedValueOnce({ isConfirmed: true } as never)
      .mockImplementationOnce(async () => {
        expect(component.procesando()).toBe(false);
        return { isConfirmed: true } as never;
      });

    await component.firmarSeleccionados();

    expect(component.procesando()).toBe(false);
    expect(component.error()).toBe(`HTTP ${status}`);
    expect(fire).toHaveBeenCalledTimes(2);
  });
  it('quita capa de carga antes de mostrar aviso de rúbrica ausente y continúa al tablero', async () => {
    api.getFirmanteActivo.mockReturnValueOnce(of({rol:'rector',orden:4,cargo_id:100,cargo:'RECTOR',nombre:'Rector Prueba',documento_identidad:123,enlace_firma:''}));
    let procesandoAlMostrar: boolean | undefined;
    const fire=vi.spyOn(Swal,'fire').mockImplementationOnce(async () => {
      procesandoAlMostrar=component.procesando();
      return {isConfirmed:true} as never;
    });
    await component.cargarCeremonias();
    expect(fire).toHaveBeenCalledOnce();
    expect(procesandoAlMostrar).toBe(false);
    expect(api.getTableroCeremoniasRector).toHaveBeenCalledOnce();
    expect(component.procesando()).toBe(false);
  });

  it('continúa al tablero con rúbrica guardada sin mostrar aviso', async () => {
    const fire=vi.spyOn(Swal,'fire').mockResolvedValue({isConfirmed:true} as never);
    await component.cargarCeremonias();
    expect(component.firmanteTieneRubrica()).toBe(true);
    expect(api.getTableroCeremoniasRector).toHaveBeenCalledOnce();
    expect(fire).not.toHaveBeenCalled();
    expect(component.procesando()).toBe(false);
  });

});
