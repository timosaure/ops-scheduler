import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GetRowIdParams,
  ModuleRegistry,
  ValueSetterParams,
  themeQuartz
} from 'ag-grid-community';
import { Component, computed, effect, inject, input, signal } from '@angular/core';

import { ModuleWithGroup } from '../../core/models/module.model';
import {
  ScheduleModuleInsert,
  ScheduleModuleUpdate,
  ScheduleModuleWithModule
} from '../../core/models/schedule-module.model';
import { ModuleService } from '../../core/services/module.service';
import { ScheduleModuleService } from '../../core/services/schedule-module.service';
import { extractErrorMessage } from '../../core/util/http-error';

ModuleRegistry.registerModules([AllCommunityModule]);

const ACTIONS_COLUMN_ID = 'actions';
type EditableField = keyof ScheduleModuleUpdate;

@Component({
  selector: 'app-schedule-module-table',
  imports: [AgGridAngular],
  templateUrl: './schedule-module-table.html'
})
export class ScheduleModuleTable {
  private readonly scheduleModuleService = inject(ScheduleModuleService);
  private readonly moduleService = inject(ModuleService);

  readonly scheduleId = input.required<number>();

  readonly rowData = signal<ScheduleModuleWithModule[]>([]);
  readonly modules = signal<ModuleWithGroup[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly adding = signal(false);

  readonly theme = themeQuartz;
  readonly getRowId = (params: GetRowIdParams<ScheduleModuleWithModule>) => String(params.data.id);

  readonly groupNames = computed(() =>
    Array.from(
      new Set(this.modules().map((module) => module.module_group?.name).filter((name): name is string => !!name))
    ).sort()
  );

  readonly defaultColDef: ColDef<ScheduleModuleWithModule> = {
    resizable: true,
    sortable: true,
    filter: true
  };

  readonly columnDefs: ColDef<ScheduleModuleWithModule>[] = [
    {
      colId: 'group',
      headerName: 'Group',
      editable: true,
      flex: 1,
      valueGetter: (params) => params.data?.module.module_group?.name ?? '',
      valueSetter: (params) => this.onGroupChanged(params),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.groupNames() })
    },
    {
      colId: 'module',
      headerName: 'Module',
      editable: true,
      flex: 2,
      valueGetter: (params) => params.data?.module.name ?? '',
      valueSetter: (params) => this.onModuleChanged(params),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: { data?: ScheduleModuleWithModule }) => ({
        values: this.modulesInGroup(params.data?.module.module_group?.name ?? null).map((module) => module.name)
      })
    },
    { headerName: 'Type', valueGetter: (params) => params.data?.module.type ?? '', flex: 1 },
    { headerName: 'Subschedule', valueGetter: (params) => params.data?.module.subschedule ?? '', flex: 1 },
    {
      field: 'relative_time_seconds',
      headerName: 'Relative time (s)',
      editable: (params) => params.data?.module.type === 'MTL',
      cellEditor: 'agNumberCellEditor',
      valueParser: (params) => Number(params.newValue),
      flex: 1
    },
    {
      field: 'delta_orbit_number',
      headerName: 'Delta orbit #',
      editable: (params) => params.data?.module.type === 'OPS',
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0 },
      valueParser: (params) => Number(params.newValue),
      flex: 1
    },
    {
      field: 'delta_orbit_angle',
      headerName: 'Delta orbit angle (°)',
      editable: (params) => params.data?.module.type === 'OPS',
      cellEditor: 'agNumberCellEditor',
      valueParser: (params) => Number(params.newValue),
      flex: 1
    },
    {
      colId: ACTIONS_COLUMN_ID,
      headerName: '',
      width: 90,
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: () => '<button type="button" class="text-xs text-red-500 hover:text-red-700">Delete</button>'
    }
  ];

  constructor() {
    effect(() => {
      const id = this.scheduleId();
      this.load(id);
    });
    this.moduleService.listAll().subscribe({
      next: (modules) => this.modules.set(modules),
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }

  private modulesInGroup(groupName: string | null): ModuleWithGroup[] {
    return this.modules().filter((module) => (module.module_group?.name ?? null) === groupName);
  }

  private load(scheduleId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.scheduleModuleService.listBySchedule(scheduleId).subscribe({
      next: (scheduleModules) => {
        this.rowData.set(scheduleModules);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  addScheduleModule(): void {
    const module = this.modules()[0];
    if (!module) {
      this.error.set('No modules available. Create a module first.');
      return;
    }
    const insert: ScheduleModuleInsert = {
      schedule_id: this.scheduleId(),
      module_id: module.id,
      ...(module.type === 'MTL'
        ? { relative_time_seconds: 0 }
        : { delta_orbit_number: 0, delta_orbit_angle: 0 })
    };
    this.adding.set(true);
    this.error.set(null);
    this.scheduleModuleService.create(insert).subscribe({
      next: (created) => {
        this.rowData.update((rows) => [...rows, created]);
        this.adding.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.adding.set(false);
      }
    });
  }

  private onGroupChanged(params: ValueSetterParams<ScheduleModuleWithModule>): boolean {
    const newGroupName = params.newValue as string;
    if (!params.data || !newGroupName || newGroupName === params.oldValue) {
      return false;
    }
    const newModule = this.modulesInGroup(newGroupName)[0];
    if (!newModule) {
      return false;
    }
    this.applyModuleChange(params.data, newModule);
    return true;
  }

  private onModuleChanged(params: ValueSetterParams<ScheduleModuleWithModule>): boolean {
    const newName = params.newValue as string;
    if (!params.data || !newName || newName === params.oldValue) {
      return false;
    }
    const groupName = params.data.module.module_group?.name ?? null;
    const newModule = this.modulesInGroup(groupName).find((module) => module.name === newName);
    if (!newModule || newModule.id === params.data.module.id) {
      return false;
    }
    this.applyModuleChange(params.data, newModule);
    return true;
  }

  private applyModuleChange(current: ScheduleModuleWithModule, newModule: ModuleWithGroup): void {
    const changes: ScheduleModuleUpdate =
      newModule.type === 'MTL'
        ? { module_id: newModule.id, relative_time_seconds: 0, delta_orbit_number: null, delta_orbit_angle: null }
        : { module_id: newModule.id, delta_orbit_number: 0, delta_orbit_angle: 0, relative_time_seconds: null };

    const updatedRow: ScheduleModuleWithModule = {
      ...current,
      module: newModule,
      module_id: newModule.id,
      relative_time_seconds: changes.relative_time_seconds ?? null,
      delta_orbit_number: changes.delta_orbit_number ?? null,
      delta_orbit_angle: changes.delta_orbit_angle ?? null
    };
    this.rowData.update((rows) => rows.map((row) => (row.id === current.id ? updatedRow : row)));

    this.error.set(null);
    this.scheduleModuleService.update(current.id, changes).subscribe({
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.rowData.update((rows) => rows.map((row) => (row.id === current.id ? current : row)));
      }
    });
  }

  onCellValueChanged(event: CellValueChangedEvent<ScheduleModuleWithModule>): void {
    const scheduleModule = event.data;
    const field = event.colDef.field as EditableField | undefined;
    if (!field || event.oldValue === event.newValue) {
      return;
    }
    const changes = { [field]: event.newValue } as ScheduleModuleUpdate;
    this.error.set(null);
    this.scheduleModuleService.update(scheduleModule.id, changes).subscribe({
      next: (updated) => {
        this.rowData.update((rows) =>
          rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
        );
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.rowData.update((rows) =>
          rows.map((row) => (row.id === scheduleModule.id ? { ...row, [field]: event.oldValue } : row))
        );
      }
    });
  }

  onCellClicked(event: CellClickedEvent<ScheduleModuleWithModule>): void {
    if (event.column.getColId() !== ACTIONS_COLUMN_ID || !event.data) {
      return;
    }
    this.deleteScheduleModule(event.data);
  }

  private deleteScheduleModule(scheduleModule: ScheduleModuleWithModule): void {
    if (!confirm(`Remove "${scheduleModule.module.name}" from this schedule?`)) {
      return;
    }
    this.error.set(null);
    this.scheduleModuleService.delete(scheduleModule.id).subscribe({
      next: () => {
        this.rowData.update((rows) => rows.filter((row) => row.id !== scheduleModule.id));
      },
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }
}
