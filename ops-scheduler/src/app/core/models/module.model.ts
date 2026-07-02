export type ModuleType = 'MTL' | 'OPS';

export const MODULE_TYPES: ModuleType[] = ['MTL', 'OPS'];

export interface Module {
  id: number;
  module_group_id: number;
  name: string;
  type: ModuleType;
  subschedule: number;
  created_at: string;
}

export interface ModuleInsert {
  module_group_id: number;
  name: string;
  type: ModuleType;
  subschedule: number;
}

export interface ModuleUpdate {
  name?: string;
  type?: ModuleType;
  subschedule?: number;
}
