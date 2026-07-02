import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Module, ModuleInsert, ModuleUpdate, ModuleWithGroup } from '../models/module.model';

const REPRESENTATION_HEADERS = { Prefer: 'return=representation' };

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/module`;

  listByGroup(moduleGroupId: number): Observable<Module[]> {
    return this.http.get<Module[]>(this.baseUrl, {
      params: { module_group_id: `eq.${moduleGroupId}`, order: 'id.asc' }
    });
  }

  listAll(): Observable<ModuleWithGroup[]> {
    return this.http.get<ModuleWithGroup[]>(this.baseUrl, {
      params: { select: '*,module_group(name,subschedule)', order: 'name.asc' }
    });
  }

  get(id: number): Observable<Module> {
    return this.http
      .get<Module[]>(this.baseUrl, { params: { id: `eq.${id}` } })
      .pipe(map((rows) => rows[0]));
  }

  create(module: ModuleInsert): Observable<Module> {
    return this.http
      .post<Module[]>(this.baseUrl, module, { headers: REPRESENTATION_HEADERS })
      .pipe(map((rows) => rows[0]));
  }

  update(id: number, changes: ModuleUpdate): Observable<Module> {
    return this.http
      .patch<Module[]>(this.baseUrl, changes, {
        params: { id: `eq.${id}` },
        headers: REPRESENTATION_HEADERS
      })
      .pipe(map((rows) => rows[0]));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { params: { id: `eq.${id}` } });
  }
}
