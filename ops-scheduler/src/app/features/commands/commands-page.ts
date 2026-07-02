import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Module } from '../../core/models/module.model';
import { ModuleService } from '../../core/services/module.service';
import { extractErrorMessage } from '../../core/util/http-error';
import { CommandTable } from './command-table';

@Component({
  selector: 'app-commands-page',
  imports: [CommandTable, RouterLink],
  templateUrl: './commands-page.html'
})
export class CommandsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly moduleService = inject(ModuleService);

  readonly module = signal<Module | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    const moduleId = Number(this.route.snapshot.paramMap.get('moduleId'));
    this.loading.set(true);
    this.moduleService.get(moduleId).subscribe({
      next: (module) => {
        this.module.set(module);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
