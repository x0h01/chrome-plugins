# Jahia Modules Helper

Bulk actions for **Jahia → Administration → Server → Modules and Extensions → Modules**.

## Features
- **All rows always shown** – adds an "All" option to the DataTables page-length select and selects it on every load.
- **Update modules** – clicks every green "download" (`_eventId_installModuleOnly`) button.
- **Start newest versions** – when several versions are installed and a newer one is stopped, starts the newest.
- **Remove older versions** – undeploys stopped versions older than the running one (never newer ones).
- **⤴ 1-click upgrade** – update → start new → remove old, for all modules.
- Panel title shows **upgradable / total** module counters.
- Always asks for confirmation (lists planned actions) before running; **Stop** button while running; per-action log with failures.
