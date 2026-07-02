import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ModuleGroup, ModuleGroupInsert, ModuleGroupUpdate } from '../models/module-group.model';

const REPRESENTATION_HEADERS = { Prefer: 'return=representation' };

@Injectable({ providedIn: 'root' })
export class ModuleGroupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/module_group`;

  list(): Observable<ModuleGroup[]> {
    return this.http.get<ModuleGroup[]>(this.baseUrl, {
      params: { order: 'name.asc' }
    });
  }

  create(group: ModuleGroupInsert): Observable<ModuleGroup> {
    return this.http
      .post<ModuleGroup[]>(this.baseUrl, group, { headers: REPRESENTATION_HEADERS })
      .pipe(map((rows) => rows[0]));
  }

  update(id: number, changes: ModuleGroupUpdate): Observable<ModuleGroup> {
    return this.http
      .patch<ModuleGroup[]>(this.baseUrl, changes, {
        params: { id: `eq.${id}` },
        headers: REPRESENTATION_HEADERS
      })
      .pipe(map((rows) => rows[0]));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { params: { id: `eq.${id}` } });
  }
}
