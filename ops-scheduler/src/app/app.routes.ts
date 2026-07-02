import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'module-groups'
  },
  {
    path: 'module-groups',
    loadComponent: () =>
      import('./features/module-groups/module-groups-page').then((m) => m.ModuleGroupsPage)
  },
  {
    path: 'modules/:moduleId/commands',
    loadComponent: () =>
      import('./features/commands/commands-page').then((m) => m.CommandsPage)
  },
  {
    path: 'schedules',
    loadComponent: () =>
      import('./features/schedules/schedules-page').then((m) => m.SchedulesPage)
  }
];
