import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Command, CommandInsert, CommandUpdate } from '../models/command.model';

const REPRESENTATION_HEADERS = { Prefer: 'return=representation' };

@Injectable({ providedIn: 'root' })
export class CommandService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/command`;

  listByModule(moduleId: number): Observable<Command[]> {
    return this.http.get<Command[]>(this.baseUrl, {
      params: {
        module_id: `eq.${moduleId}`,
        order: 'relative_time.asc,relative_orbit_angle.asc,id.asc'
      }
    });
  }

  listByModules(moduleIds: number[]): Observable<Command[]> {
    if (moduleIds.length === 0) {
      return of([]);
    }
    return this.http.get<Command[]>(this.baseUrl, {
      params: {
        module_id: `in.(${moduleIds.join(',')})`,
        order: 'module_id.asc,relative_time.asc,relative_orbit_angle.asc,id.asc'
      }
    });
  }

  create(command: CommandInsert): Observable<Command> {
    return this.http
      .post<Command[]>(this.baseUrl, command, { headers: REPRESENTATION_HEADERS })
      .pipe(map((rows) => rows[0]));
  }

  update(id: number, changes: CommandUpdate): Observable<Command> {
    return this.http
      .patch<Command[]>(this.baseUrl, changes, {
        params: { id: `eq.${id}` },
        headers: REPRESENTATION_HEADERS
      })
      .pipe(map((rows) => rows[0]));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { params: { id: `eq.${id}` } });
  }
}
