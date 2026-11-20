import { Component, OnInit, computed, inject, Input, ViewChild, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import { DiplomasApiService } from './services/diplomas-api.service';
import { PeriodoAcademicoService } from './services/periodo-academico.service';

@Component({
  selector: 'diplomas-periodo-selector',
  imports: [RouterLink, MatFormFieldModule, MatSelectModule, MatButtonModule],
  template: `
    <section class="periodo-panel" aria-label="Período académico">
      <mat-form-field appearance="outline">
        <mat-label>Período académico</mat-label>
        <mat-select [value]="estado.seleccionado()?.Id ?? null" (selectionChange)="seleccionar($event.value)" [disabled]="cargando() || bloqueado">
          <mat-select-trigger>{{ estado.seleccionado()?.Nombre }}</mat-select-trigger>
          <mat-option [value]="null">Seleccione un período</mat-option>
          @for (p of periodosDisponibles(); track p.Id) {
            <mat-option [value]="p.Id">{{ p.Nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (mostrarEnlace) { <a mat-stroked-button routerLink="/aprobados">Estudiantes aprobados</a> }
      @if (cargando()) { <span role="status">Cargando períodos…</span> }
      @if (error()) {
        <span class="error" role="alert">{{ error() }}</span>
        <button mat-button type="button" (click)="cargar()">Reintentar</button>
      }
      @if (!cargando() && !error() && !periodosDisponibles().length) { <span>No hay períodos académicos disponibles.</span> }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    :host { display: block; margin-bottom: 24px; }
    .periodo-panel { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 20px; border: 1px solid #d0e0eb; border-radius: 12px; background: #fff; }
    mat-form-field { flex: 1 1 280px; margin-bottom: -20px; }
    .error { color: #b3261e; }
  `
})
export class PeriodoSelectorComponent implements OnInit {
  @Input() antesDeCambiar: () => boolean = () => true;
  @Input() bloqueado = false;
  @Input() mostrarEnlace = true;
  @Input() incluirHistoricos = false;
  @ViewChild(MatSelect) private selector?: MatSelect;
  readonly estado = inject(PeriodoAcademicoService);
  private readonly api = inject(DiplomasApiService);
  readonly periodos = this.estado.periodos;
  readonly periodosActivos = computed(() => this.periodos().filter(p => p.Activo));
  readonly cargando = signal(false);
  readonly error = signal('');

  ngOnInit(): void { if (!this.periodos().length) void this.cargar(); }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const periodos = await firstValueFrom(this.api.getPeriodosAcademicos());
      this.periodos.set(periodos.filter(p => p.CodigoAbreviacion === 'PA').sort((a, b) => b.Year - a.Year || Number(b.Ciclo) - Number(a.Ciclo) || b.Id - a.Id));
    } catch {
      this.error.set('No fue posible cargar períodos académicos.');
    } finally {
      this.cargando.set(false);
    }
  }

  periodosDisponibles() {
    return this.incluirHistoricos ? this.periodos() : this.periodosActivos();
  }

  seleccionar(raw: string | number | null): void {
    const siguiente = this.periodosDisponibles().find(p => p.Id === Number(raw)) ?? null;
    if (siguiente?.Id === this.estado.seleccionado()?.Id) return;
    if (this.bloqueado || !this.antesDeCambiar()) {
      // Restore the displayed value when the user cancels discarding changes.
      if (this.selector) this.selector.value = this.estado.seleccionado()?.Id ?? null;
      return;
    }
    this.estado.seleccionado.set(siguiente);
  }
}
