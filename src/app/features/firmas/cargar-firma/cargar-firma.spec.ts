import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiplomasApiService } from '../../../core/services/diplomas-api.service';
import { CargarFirmaComponent } from './cargar-firma';

const firmante = {
  rol: 'rector',
  orden: 4,
  cargo_id: 100,
  cargo: 'RECTOR',
  nombre: 'Ada Lovelace',
  documento_identidad: 10000000
};

class DiplomasApiServiceMock {
  getFirmanteActivo = vi.fn(() => of(firmante));
  subirFirma = vi.fn(() => of({
    firmante,
    enlace_firma: 'uuid-firma',
    documento: {},
    firma_firmante: {
      id: 1,
      documento_identidad: 10000000,
      enlace_firma: 'uuid-firma',
      activo: true
    }
  }));
}

describe('CargarFirmaComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => {
      const cleanUrl = url.replace(/^\.\//, '');
      return readFile(join(process.cwd(), 'src/app/features/firmas/cargar-firma', cleanUrl), 'utf-8');
    });
  });

  let fixture: ComponentFixture<CargarFirmaComponent>;
  let component: CargarFirmaComponent;
  let api: DiplomasApiServiceMock;
  let objectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [CargarFirmaComponent],
      providers: [{ provide: DiplomasApiService, useClass: DiplomasApiServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(CargarFirmaComponent);
    component = fixture.componentInstance;
    api = TestBed.inject(DiplomasApiService) as unknown as DiplomasApiServiceMock;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    objectUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
  });


  it('precarga y bloquea el documento del usuario autenticado', () => {
    fixture.destroy();
    localStorage.setItem('user', btoa(JSON.stringify({
      user: { documento: '1111111111' },
      userService: { documento: '1023026828' }
    })));

    fixture = TestBed.createComponent(CargarFirmaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const control = component.validarFirmanteForm.controls.documento;
    const input = fixture.debugElement.query(By.css('#documento')).nativeElement as HTMLInputElement;

    expect(control.value).toBe(1023026828);
    expect(control.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('1023026828');
  });

  it('TEST-FIRMA-003 no habilita cargue sin firmante validado', () => {
    expect(component.puedeSubir()).toBe(false);
    const button = fixture.debugElement.query(By.css('[data-testid="subir-firma"]')).nativeElement as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('TEST-FIRMA-004 rechaza archivos no PNG', async () => {
    component.validarFirmanteForm.controls.documento.setValue(10000000);
    await component.validarFirmante();
    const file = new File(['texto'], 'firma.txt', { type: 'text/plain' });

    component.onArchivoSeleccionado(file);

    expect(component.archivo()).toBeNull();
    expect(component.archivoError()).toContain('formato');
  });

  it('TEST-FIRMA-005 muestra preview de PNG valido', () => {
    const file = new File(['png'], 'firma.png', { type: 'image/png' });

    component.onArchivoSeleccionado(file);
    fixture.detectChanges();

    expect(component.previewUrl()).toBe('blob:preview');
    expect(component.archivo()?.name).toBe('firma.png');
  });

  it('TEST-FIRMA-006 habilita boton cuando hay firmante + archivo', async () => {
    component.validarFirmanteForm.controls.documento.setValue(10000000);
    await component.validarFirmante();
    component.onArchivoSeleccionado(new File(['png'], 'firma.png', { type: 'image/png' }));

    expect(component.puedeSubir()).toBe(true);
  });

  it('TEST-FIRMA-007 muestra estado de exito', async () => {
    component.validarFirmanteForm.controls.documento.setValue(10000000);
    await component.validarFirmante();
    component.onArchivoSeleccionado(new File(['png'], 'firma.png', { type: 'image/png' }));

    await component.subirFirma();

    expect(component.estado()).toBe('exito');
    expect(component.resultado()?.enlace_firma).toBe('uuid-firma');
  });

  it('muestra la firma registrada si el firmante ya tiene una activa', async () => {
    api.getFirmanteActivo.mockReturnValueOnce(of({
      ...firmante,
      enlace_firma: 'uuid-firma-existente',
      firma_imagen: 'data:image/png;base64,AAAA',
      firma_firmante: {
        id: 2,
        documento_identidad: 10000000,
        enlace_firma: 'uuid-firma-existente',
        activo: true
      }
    }));
    component.validarFirmanteForm.controls.documento.setValue(10000000);

    await component.validarFirmante();
    fixture.detectChanges();

    expect(component.enlaceFirmaActual()).toBe('uuid-firma-existente');
    expect(component.firmaImagenActual()).toBe('data:image/png;base64,AAAA');
    expect(fixture.nativeElement.textContent).toContain('uuid-firma-existente');
    const image = fixture.debugElement.query(By.css('.firma-registrada__preview img')).nativeElement as HTMLImageElement;
    expect(image.src).toContain('data:image/png;base64,AAAA');
  });

  it('TEST-FIRMA-008 muestra error comprensible si falla backend', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.subirFirma.mockReturnValueOnce(throwError(() => new Error('No fue posible cargar la firma. Intente nuevamente.')));
    component.validarFirmanteForm.controls.documento.setValue(10000000);
    await component.validarFirmante();
    component.onArchivoSeleccionado(new File(['png'], 'firma.png', { type: 'image/png' }));

    await component.subirFirma();

    expect(component.estado()).toBe('error');
    expect(component.error()).toContain('No fue posible cargar la firma');
    consoleError.mockRestore();
  });
});
