export type {
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types.js';
export { Constants } from './database.types.js';

import type { Enums } from './database.types.js';

export type PlatformRole = Enums<'platform_role'>;
