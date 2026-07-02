export interface ModuleGroup {
  id: number;
  name: string;
  created_at: string;
}

export interface ModuleGroupInsert {
  name: string;
}

export interface ModuleGroupUpdate {
  name?: string;
}
