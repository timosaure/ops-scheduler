import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ModuleGroup } from '../../core/models/module-group.model';
import { ModuleGroupService } from '../../core/services/module-group.service';
import { extractErrorMessage } from '../../core/util/http-error';

@Component({
  selector: 'app-module-group-list',
  imports: [FormsModule],
  templateUrl: './module-group-list.html'
})
export class ModuleGroupList {
  private readonly moduleGroupService = inject(ModuleGroupService);

  readonly selectedId = input<number | null>(null);
  readonly selectedIdChange = output<number | null>();

  readonly groups = signal<ModuleGroup[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly editingId = signal<number | null>(null);
  readonly editingName = signal('');
  readonly editingSubschedule = signal<number | null>(null);

  readonly newGroupName = signal('');
  readonly newGroupSubschedule = signal<number | null>(null);
  readonly creating = signal(false);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.moduleGroupService.list().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  select(group: ModuleGroup): void {
    this.selectedIdChange.emit(group.id);
  }

  startEdit(group: ModuleGroup, event: Event): void {
    event.stopPropagation();
    this.editingId.set(group.id);
    this.editingName.set(group.name);
    this.editingSubschedule.set(group.subschedule);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.editingSubschedule.set(null);
  }

  saveEdit(group: ModuleGroup): void {
    const name = this.editingName().trim();
    const subschedule = this.editingSubschedule();
    if (!name || subschedule === null || Number.isNaN(subschedule)) {
      return;
    }
    if (name === group.name && subschedule === group.subschedule) {
      this.cancelEdit();
      return;
    }
    this.error.set(null);
    this.moduleGroupService.update(group.id, { name, subschedule }).subscribe({
      next: (updated) => {
        this.groups.update((list) =>
          list.map((g) => (g.id === updated.id ? updated : g)).sort((a, b) => a.name.localeCompare(b.name))
        );
        this.cancelEdit();
      },
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }

  createGroup(): void {
    const name = this.newGroupName().trim();
    const subschedule = this.newGroupSubschedule();
    if (!name || subschedule === null || Number.isNaN(subschedule)) {
      return;
    }
    this.creating.set(true);
    this.error.set(null);
    this.moduleGroupService.create({ name, subschedule }).subscribe({
      next: (created) => {
        this.groups.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
        this.newGroupName.set('');
        this.newGroupSubschedule.set(null);
        this.creating.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.creating.set(false);
      }
    });
  }

  deleteGroup(group: ModuleGroup, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete module group "${group.name}"? This is only possible if it has no modules.`)) {
      return;
    }
    this.error.set(null);
    this.moduleGroupService.delete(group.id).subscribe({
      next: () => {
        this.groups.update((list) => list.filter((g) => g.id !== group.id));
        if (this.selectedId() === group.id) {
          this.selectedIdChange.emit(null);
        }
      },
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }
}
