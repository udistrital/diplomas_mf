import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DiplomasApiService } from '../../core/services/diplomas-api.service';
import { RegistroControlComponent } from './registro-control';

describe('RegistroControlComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => {
      const cleanUrl = url.replace(/^\.\//, '');
      return readFile(join(process.cwd(), 'src/app/features/registro-control', cleanUrl), 'utf-8');
    });
  });

  it('filtra las ceremonias por facultad y reinicia la ceremonia seleccionada', async () => {
    const api = {
      getOpcionesRegistroControl: vi.fn(() => of({
        facultades: [
          {
            id: 1,
            nombre: 'Facultad de Ingeniería',
            ceremonias: [{ id: 10, fecha: '2026-10-16T15:00:00Z', lugar: 'Auditorio Sabio Caldas', diplomas_disponibles: 12 }]
          },
          {
            id: 2,
            nombre: 'Facultad de Ciencias',
            ceremonias: [{ id: 20, fecha: '2026-11-20T15:00:00Z', lugar: 'Aduanilla de Paiba', diplomas_disponibles: 8 }]
          }
        ]
      })),
      descargarDiplomasRegistroControl: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RegistroControlComponent],
      providers: [{ provide: DiplomasApiService, useValue: api }]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistroControlComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.seleccionarFacultad(1);
    expect(component.diplomasDisponibles()).toBe(12);
    expect(component.ceremonias()).toEqual([
      expect.objectContaining({ id: 10, lugar: 'Auditorio Sabio Caldas' })
    ]);

    component.seleccionarCeremonia(10);
    component.seleccionarFacultad(2);
    expect(component.ceremoniaId()).toBeNull();
    expect(component.ceremonias()).toEqual([
      expect.objectContaining({ id: 20, lugar: 'Aduanilla de Paiba' })
    ]);
    expect(component.diplomasDisponibles()).toBe(8);
  });
  it.each(['message', 'error'])('muestra el detalle de descarga del MID desde %s en un Blob JSON', async (campo) => {
    const mensaje = 'No está configurada la consulta interna para el reporte de diplomas';
    const blob = new Blob([], { type: 'application/json' });
    Object.defineProperty(blob, 'text', { value: async () => JSON.stringify({ [campo]: mensaje }) });
    const api = {
      getOpcionesRegistroControl: vi.fn(() => of({ facultades: [] })),
      descargarDiplomasRegistroControl: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409, error: blob })))
    };
    await TestBed.configureTestingModule({
      imports: [RegistroControlComponent],
      providers: [{ provide: DiplomasApiService, useValue: api }]
    }).compileComponents();
    const fixture = TestBed.createComponent(RegistroControlComponent);
    fixture.detectChanges();
    fixture.componentInstance.descargar();
    await fixture.whenStable();
    expect(fixture.componentInstance.mensaje()).toBe(mensaje);
    expect(fixture.componentInstance.descargando()).toBe(false);
  });

});
