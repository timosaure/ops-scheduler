import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GetRowIdParams,
  ModuleRegistry,
  themeQuartz
} from 'ag-grid-community';
import { CellSelectionModule, ClipboardModule } from 'ag-grid-enterprise';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MODULE_TYPES, Module, ModuleUpdate } from '../../core/models/module.model';
import { ModuleService } from '../../core/services/module.service';
import { extractErrorMessage } from '../../core/util/http-error';

ModuleRegistry.registerModules([AllCommunityModule, ClipboardModule, CellSelectionModule]);

const ACTIONS_COLUMN_ID = 'actions';
type EditableField = keyof ModuleUpdate;

@Component({
  selector: 'app-module-table',
  imports: [AgGridAngular],
  templateUrl: './module-table.html'
})
export class ModuleTable {
  private readonly moduleService = inject(ModuleService);
  private readonly router = inject(Router);

  readonly groupId = input.required<number>();

  readonly rowData = signal<Module[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);

  readonly theme = themeQuartz;
  readonly getRowId = (params: GetRowIdParams<Module>) => String(params.data.id);

  readonly defaultColDef: ColDef<Module> = {
    resizable: true,
    sortable: true,
    filter: true
  };

  readonly cellSelection = true;

  readonly columnDefs: ColDef<Module>[] = [
    { field: 'name', headerName: 'Name', editable: true, flex: 2 },
    {
      field: 'type',
      headerName: 'Type',
      editable: true,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: MODULE_TYPES }
    },
    {
      field: 'subschedule',
      headerName: 'Subschedule',
      editable: true,
      flex: 1,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0 },
      valueParser: (params) => Number(params.newValue)
    },
    {
      colId: ACTIONS_COLUMN_ID,
      headerName: '',
      width: 160,
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: () =>
        '<div class="flex h-full items-center gap-3">' +
        '<button type="button" class="commands-link text-xs text-blue-600 hover:text-blue-800">Commands</button>' +
        '<button type="button" class="delete-link text-xs text-red-500 hover:text-red-700">Delete</button>' +
        '</div>'
    }
  ];

  constructor() {
    effect(() => {
      const id = this.groupId();
      this.load(id);
    });
  }

  private load(groupId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.moduleService.listByGroup(groupId).subscribe({
      next: (modules) => {
        this.rowData.set(modules);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  addModule(): void {
    this.creating.set(true);
    this.error.set(null);
    this.moduleService
      .create({
        module_group_id: this.groupId(),
        name: 'New module',
        type: 'MTL',
        subschedule: 0
      })
      .subscribe({
        next: (created) => {
          this.rowData.update((rows) => [...rows, created]);
          this.creating.set(false);
        },
        error: (err: unknown) => {
          this.error.set(extractErrorMessage(err));
          this.creating.set(false);
        }
      });
  }

  onCellValueChanged(event: CellValueChangedEvent<Module>): void {
    const module = event.data;
    const field = event.colDef.field as EditableField | undefined;
    if (!field || event.oldValue === event.newValue) {
      return;
    }
    const changes = { [field]: event.newValue } as ModuleUpdate;
    this.error.set(null);
    this.moduleService.update(module.id, changes).subscribe({
      next: (updated) => {
        this.rowData.update((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.rowData.update((rows) =>
          rows.map((row) => (row.id === module.id ? { ...row, [field]: event.oldValue } : row))
        );
      }
    });
  }

  onCellClicked(event: CellClickedEvent<Module>): void {
    if (event.column.getColId() !== ACTIONS_COLUMN_ID || !event.data) {
      return;
    }
    const target = event.event?.target as HTMLElement | null;
    if (target?.closest('.commands-link')) {
      this.router.navigate(['/modules', event.data.id, 'commands']);
      return;
    }
    this.deleteModule(event.data);
  }

  private deleteModule(module: Module): void {
    if (!confirm(`Delete module "${module.name}"?`)) {
      return;
    }
    this.error.set(null);
    this.moduleService.delete(module.id).subscribe({
      next: () => {
        this.rowData.update((rows) => rows.filter((row) => row.id !== module.id));
      },
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }
}
