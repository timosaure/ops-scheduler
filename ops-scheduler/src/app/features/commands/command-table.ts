import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GetRowIdParams,
  ModuleRegistry,
  ValueFormatterParams,
  ValueParserParams,
  themeQuartz
} from 'ag-grid-community';
import { CellSelectionModule, ClipboardModule } from 'ag-grid-enterprise';
import { Component, computed, effect, inject, input, signal } from '@angular/core';

import { ModuleType } from '../../core/models/module.model';
import { Command, CommandUpdate } from '../../core/models/command.model';
import { CommandService } from '../../core/services/command.service';
import { extractErrorMessage } from '../../core/util/http-error';
import {
  commandOrderValue,
  formatRelativeTime,
  INVALID_RELATIVE_TIME,
  parseRelativeTime
} from '../../core/util/orbit-time';

ModuleRegistry.registerModules([AllCommunityModule, ClipboardModule, CellSelectionModule]);

const ACTIONS_COLUMN_ID = 'actions';
type EditableField = keyof CommandUpdate;

@Component({
  selector: 'app-command-table',
  imports: [AgGridAngular],
  templateUrl: './command-table.html'
})
export class CommandTable {
  private readonly commandService = inject(CommandService);

  readonly moduleId = input.required<number>();
  readonly moduleType = input.required<ModuleType>();

  readonly rowData = signal<Command[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);

  readonly theme = themeQuartz;
  readonly getRowId = (params: GetRowIdParams<Command>) => String(params.data.id);

  readonly defaultColDef: ColDef<Command> = {
    resizable: true,
    sortable: false,
    filter: true
  };

  readonly cellSelection = true;

  readonly positionField = computed<EditableField>(() =>
    this.moduleType() === 'MTL' ? 'relative_time' : 'relative_orbit_angle'
  );

  readonly columnDefs = computed<ColDef<Command>[]>(() => {
    const isMtl = this.moduleType() === 'MTL';
    return [
      { field: 'name', headerName: 'Name', editable: true, flex: 2 },
      {
        field: this.positionField(),
        headerName: isMtl ? 'Relative time (hh:mm:ss.SSS)' : 'Relative orbit angle (°)',
        editable: true,
        flex: 1,
        ...(isMtl
          ? {
              cellEditor: 'agTextCellEditor',
              cellEditorParams: { useFormatter: true },
              valueFormatter: (params: ValueFormatterParams<Command>) =>
                formatRelativeTime(params.value as string | null),
              valueParser: (params: ValueParserParams<Command>) => parseRelativeTime(params.newValue)
            }
          : {
              cellEditor: 'agNumberCellEditor',
              valueParser: (params: ValueParserParams<Command>) => Number(params.newValue)
            })
      },
      {
        colId: ACTIONS_COLUMN_ID,
        headerName: '',
        width: 90,
        editable: false,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: () =>
          '<button type="button" class="text-xs text-red-500 hover:text-red-700">Delete</button>'
      }
    ];
  });

  constructor() {
    effect(() => {
      const id = this.moduleId();
      this.load(id);
    });
  }

  private sortRows(rows: Command[]): Command[] {
    const moduleType = this.moduleType();
    return [...rows].sort((a, b) => {
      const diff = commandOrderValue(moduleType, a) - commandOrderValue(moduleType, b);
      return diff !== 0 ? diff : a.id - b.id;
    });
  }

  private load(moduleId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.commandService.listByModule(moduleId).subscribe({
      next: (commands) => {
        this.rowData.set(this.sortRows(commands));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  addCommand(): void {
    this.creating.set(true);
    this.error.set(null);
    const isMtl = this.moduleType() === 'MTL';
    this.commandService
      .create({
        module_id: this.moduleId(),
        name: 'New command',
        [this.positionField()]: isMtl ? 'PT0S' : 0
      })
      .subscribe({
        next: (created) => {
          this.rowData.update((rows) => this.sortRows([...rows, created]));
          this.creating.set(false);
        },
        error: (err: unknown) => {
          this.error.set(extractErrorMessage(err));
          this.creating.set(false);
        }
      });
  }

  onCellValueChanged(event: CellValueChangedEvent<Command>): void {
    const command = event.data;
    const field = event.colDef.field as EditableField | undefined;
    if (!field || event.oldValue === event.newValue) {
      return;
    }
    if (
      (typeof event.newValue === 'number' && Number.isNaN(event.newValue)) ||
      event.newValue === INVALID_RELATIVE_TIME
    ) {
      this.error.set('Invalid time format. Use hh:mm:ss.SSS.');
      this.rowData.update((rows) =>
        rows.map((row) => (row.id === command.id ? { ...row, [field]: event.oldValue } : row))
      );
      return;
    }
    const changes = { [field]: event.newValue } as CommandUpdate;
    this.error.set(null);
    this.commandService.update(command.id, changes).subscribe({
      next: (updated) => {
        this.rowData.update((rows) =>
          this.sortRows(rows.map((row) => (row.id === updated.id ? updated : row)))
        );
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.rowData.update((rows) =>
          rows.map((row) => (row.id === command.id ? { ...row, [field]: event.oldValue } : row))
        );
      }
    });
  }

  onCellClicked(event: CellClickedEvent<Command>): void {
    if (event.column.getColId() !== ACTIONS_COLUMN_ID || !event.data) {
      return;
    }
    this.deleteCommand(event.data);
  }

  private deleteCommand(command: Command): void {
    if (!confirm(`Delete command "${command.name}"?`)) {
      return;
    }
    this.error.set(null);
    this.commandService.delete(command.id).subscribe({
      next: () => {
        this.rowData.update((rows) => rows.filter((row) => row.id !== command.id));
      },
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }
}
