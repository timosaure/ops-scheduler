import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ScheduleModule,
  ScheduleModuleInsert,
  ScheduleModuleUpdate,
  ScheduleModuleWithModule
} from '../models/schedule-module.model';

const REPRESENTATION_HEADERS = { Prefer: 'return=representation' };
const WITH_MODULE_SELECT = '*,module(*,module_group(name,subschedule))';

@Injectable({ providedIn: 'root' })
export class ScheduleModuleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/schedule_module`;

  listBySchedule(scheduleId: number): Observable<ScheduleModuleWithModule[]> {
    return this.http.get<ScheduleModuleWithModule[]>(this.baseUrl, {
      params: { schedule_id: `eq.${scheduleId}`, select: WITH_MODULE_SELECT, order: 'position.asc,id.asc' }
    });
  }

  create(scheduleModule: ScheduleModuleInsert): Observable<ScheduleModuleWithModule> {
    return this.http
      .post<ScheduleModuleWithModule[]>(this.baseUrl, scheduleModule, {
        params: { select: WITH_MODULE_SELECT },
        headers: REPRESENTATION_HEADERS
      })
      .pipe(map((rows) => rows[0]));
  }

  update(id: number, changes: ScheduleModuleUpdate): Observable<ScheduleModule> {
    return this.http
      .patch<ScheduleModule[]>(this.baseUrl, changes, {
        params: { id: `eq.${id}` },
        headers: REPRESENTATION_HEADERS
      })
      .pipe(map((rows) => rows[0]));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { params: { id: `eq.${id}` } });
  }
}
