# Introduction

This project is for a small tool which allows to build satellite operation schedules. So called "modules" are defined which contain a timeline of commands to be executed on the satellite. Every module is either an MTL module, which stands for mission timeline. Those modules have a relative time on every command, when it should be executed. The other modules are OPS modules, which stands for orbit position schedule. They contain a relative orbit angle and will be executed when the satellite reaches that position in the orbit.

Every module also has a property "subschedule" which determines in which subschedule the command will be uploaded. Every module also has a name.

Modules are grouped into module groups, which also have name.

The last structure is the schedule which is a timeline of modules and when they should be executed. Again MTL modules get a relative time, OPS modules get a delta orbit number and delta orbit angle. The orbit number is just a counter that is incremented after every revolution. The schedule gets additional properties, like the starting time, starting orbit number, starting orbit angle and orbit duration in seconds. For simplicity we assume the orbit to be perfectly circular and velocity to be constant throughout.

The final goal is to generate an Excel file documenting the schedule.

# Technologies

- Frontend: Angular
  - Table library: AG-Grid
  - Excel editing: exceljs
- Backend: Assume a Postgres with Postgrest is running
- Schema management: Flyway

# Database schema

Flyway migrations live in `sql/`

# Frontend structure (`ops-scheduler/`)

The Angular app talks directly to PostgREST (no separate backend layer). The API base URL is configured in `src/environments/environment.ts`.

- `core/models` — TypeScript interfaces mirroring the `module_group`/`module` tables.
- `core/services` — `ModuleGroupService` and `ModuleService`, thin wrappers around PostgREST's REST conventions (`?column=eq.value` filtering, `Prefer: return=representation` on writes) using `HttpClient`.
- `core/util/http-error.ts` — shared helper to turn PostgREST error responses into a display message.
- `features/module-groups/` — the module group management view, routed at `/module-groups` (the default route redirects here):
  - `module-group-list` — sidebar to list/create/rename/delete module groups.
  - `module-table` — AG-Grid editor for the modules belonging to the selected group (editable name/type/subschedule columns, add-row and per-row delete), each cell edit is saved immediately via PATCH and reverted on error.
  - `module-groups-page` — container component wiring the list and table together.
