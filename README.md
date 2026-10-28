# Alma Workflow Assistant

A modular WebExtension (Manifest V3) for Ex Libris Alma that automates physical item metadata transformations, note auditing, and inventory field migration.

Compatible with **Mozilla Firefox** and **Microsoft Edge** (Chromium).

---

## Technical Overview

The extension interacts with Ex Libris Alma's single-page application (SPA) DOM to execute multi-step metadata operations within the **Physical Item Editor** (*Editor für physische Exemplare*).

### Automation Pipeline

```
[Trigger: Alt + X or HUD Action]
                 │
                 ▼
1. Navigation to "Notizen" Tab (Alt + 3)
                 │
                 ▼
2. Audit Notes for Keyword ("retro", case-insensitive)
   - Scans "Fachliche Notizen" (Öffentliche Notiz, Benutzungs-Notiz)
   - Scans "Interne Notizen" (Interne Notiz 1–3)
   - Scans "Statistiknotizen" (Statistiknotiz 1–3)
                 │
                 ▼
3. Return to "Allgemein" Tab (Alt + 1)
                 │
                 ▼
4. Conditional Field Transformation:
   ├── Existing Inventory Data Check (Inventarnummer or Inventarisierungsdatum != empty):
   │     └── Clear "Exemplarsignatur"
   │
   └── Empty Inventory Data (Standard Migration):
         ├── Cut "Exemplarsignatur" ──► Paste into "Inventarnummer"
         ├── Clear "Exemplarsignatur"
         └── Assign "Inventarisierungsdatum":
               • Keyword detected   ──► 31.12.1984
               • Keyword absent     ──► 11/11/1999
                 │
                 ▼
5. Visual Verification State:
   - Modified DOM nodes receive subtle visual indicators (border/background).
   - Operation log written to HUD and console.
                 │
                 ▼
6. Manual Confirmation Gate (Default Policy):
   - Execution pauses. No automatic persistence.
   - User reviews values and dispatches Alt + S ("Speichern") to commit.
```

---

## Features

- **Cross-Browser WebExtension (Manifest V3)**: Works natively in Firefox (109+) and Edge/Chrome without build steps or vendor lock-in.
- **Framework-Agnostic Event Dispatcher**: Correctly triggers synthetic `input`, `change`, and `blur` events via prototype property descriptors to ensure framework state synchronization (Angular/Dojo).
- **Resilient DOM Resolvers**: Hierarchical selector engine with fallbacks across ARIA labels, form groupings, and localized text anchors.
- **In-Page Head-Up Display (HUD)**: Draggable, collapsible floating toolbar showing real-time page detection, execution status, and element verification diagnostics.
- **Safe Execution Policy**: Enforces a strict manual confirmation boundary prior to saving records, mitigating unintended data mutation.
- **Configurable Rules**: Dates, search keywords, and safety thresholds are customizable via the extension popup or synchronized storage.

---

## Keyboard Shortcuts

| Shortcut | Context | Description |
| :--- | :--- | :--- |
| `Alt + X` | Physical Item Editor (*Editor für physische Exemplare*) | Executes full inspection and field transformation |
| `Alt + S` | Physical Item Editor (*Editor für physische Exemplare*) | Native Alma shortcut to save and commit record |
| `Alt + E` | Exemplar List (*Liste der Exemplare*) | Opens the action menu (`...`) and selects *Bearbeiten* on the active item |

---

## Installation

### Mozilla Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** (*Temporäres Add-on laden...*).
3. Select the `manifest.json` file inside the project directory.
4. The extension is loaded and active.

### Microsoft Edge

1. Open Edge and navigate to `edge://extensions`.
2. Enable **Developer mode** toggle in the left sidebar.
3. Click **Load unpacked** (*Entpackte Erweiterung laden*).
4. Select the project root folder.
5. The extension is loaded and active.

---

## Project Structure

```
alma/
├── manifest.json              # WebExtension specification (MV3, Firefox/Chromium)
├── README.md                  # Project documentation
├── .gitignore                 # Git ignore rules
├── config/
│   └── default-config.js      # Default configuration constants & storage adapter
├── utils/
│   ├── logger.js              # Event-broadcasting logger
│   └── dom-utils.js           # Framework-safe input triggers & timing utilities
├── content/
│   ├── dom-selectors.js       # Element selectors & heuristic lookup strategies
│   ├── editor-handler.js      # Note scanning & inventory field transformation logic
│   ├── navigation-handler.js  # Navigation actions for item lists & search results
│   ├── ui-panel.js            # In-page draggable floating toolbar component
│   ├── ui-panel.css           # HUD styles and animations
│   └── alma-core.js           # Content script entry point & hotkey listener
├── popup/
│   ├── popup.html             # Extension browser action UI
│   ├── popup.css              # Action panel styling
│   └── popup.js               # Configuration and tab communication controller
└── icons/
    ├── icon.svg               # Vector source icon
    ├── icon-48.png            # 48x48 raster icon
    └── icon-128.png           # 128x128 raster icon
```

---

## Configuration

Settings can be customized directly via the extension action popup:

- `dateRetro`: Default `31.12.1984` (assigned when the audit keyword is found).
- `dateNoRetro`: Default `11/11/1999` (assigned when no audit keyword is found).
- `searchKeyword`: Default `retro` (case-insensitive substring match).
- `requireManualSave`: Default `true` (enforces manual review before dispatching save).
- `showFloatingHud`: Default `true` (renders the in-page floating toolbar).

---

## License

MIT License. See standard licensing terms for distribution and modification.
