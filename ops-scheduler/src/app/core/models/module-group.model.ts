export interface ModuleGroup {
  id: number;
  name: string;
  subschedule: number;
  created_at: string;
}

export interface ModuleGroupInsert {
  name: string;
  subschedule: number;
}

export interface ModuleGroupUpdate {
  name?: string;
  subschedule?: number;
}
