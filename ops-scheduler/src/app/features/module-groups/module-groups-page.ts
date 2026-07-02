import { Component, signal } from '@angular/core';

import { ModuleGroupList } from './module-group-list';
import { ModuleTable } from './module-table';

@Component({
  selector: 'app-module-groups-page',
  imports: [ModuleGroupList, ModuleTable],
  templateUrl: './module-groups-page.html'
})
export class ModuleGroupsPage {
  readonly selectedGroupId = signal<number | null>(null);
}
