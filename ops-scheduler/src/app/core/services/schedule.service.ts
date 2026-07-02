import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Schedule, ScheduleInsert, ScheduleUpdate } from '../models/schedule.model';

const REPRESENTATION_HEADERS = { Prefer: 'return=representation' };

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/schedule`;

  list(): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(this.baseUrl, {
      params: { order: 'name.asc' }
    });
  }

  create(schedule: ScheduleInsert): Observable<Schedule> {
    return this.http
      .post<Schedule[]>(this.baseUrl, schedule, { headers: REPRESENTATION_HEADERS })
      .pipe(map((rows) => rows[0]));
  }

  update(id: number, changes: ScheduleUpdate): Observable<Schedule> {
    return this.http
      .patch<Schedule[]>(this.baseUrl, changes, {
        params: { id: `eq.${id}` },
        headers: REPRESENTATION_HEADERS
      })
      .pipe(map((rows) => rows[0]));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { params: { id: `eq.${id}` } });
  }
}
