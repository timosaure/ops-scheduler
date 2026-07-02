export type ModuleType = 'MTL' | 'OPS';

export const MODULE_TYPES: ModuleType[] = ['MTL', 'OPS'];

export type ModuleUpload = 'LIVE' | 'NOT_LIVE';

export const MODULE_UPLOADS: ModuleUpload[] = ['LIVE', 'NOT_LIVE'];

export interface Module {
  id: number;
  module_group_id: number;
  name: string;
  type: ModuleType;
  subschedule: number;
  upload: ModuleUpload;
  created_at: string;
}

export interface ModuleInsert {
  module_group_id: number;
  name: string;
  type: ModuleType;
  subschedule: number;
  upload: ModuleUpload;
}

export interface ModuleUpdate {
  name?: string;
  type?: ModuleType;
  subschedule?: number;
  upload?: ModuleUpload;
}

export interface ModuleWithGroup extends Module {
  module_group: { name: string } | null;
}
