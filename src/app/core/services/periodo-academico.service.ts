import { Injectable, signal } from '@angular/core';
export interface PeriodoAcademico { Id: number; Nombre: string; Year: number; Ciclo: string; CodigoAbreviacion: string; Activo: boolean; }
@Injectable({ providedIn: 'root' })
export class PeriodoAcademicoService {
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly seleccionado = signal<PeriodoAcademico | null>(null);
  exigirId(): number {
    const id = this.seleccionado()?.Id;
    if (!id || id <= 0) throw new Error('Seleccione un período académico.');
    return id;
  }
}
