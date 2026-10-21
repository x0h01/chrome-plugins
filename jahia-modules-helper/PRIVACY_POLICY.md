# Privacy Policy for Jahia Modules Helper

**Last Updated:** October 20, 2026

## Introduction

Jahia Modules Helper is a Chrome extension that adds bulk actions to the **Jahia → Administration → Server → Modules and Extensions → Modules** page. It is intended for Jahia administrators who manage modules on servers they are authorized to administer.

## Purpose of the Extension

Jahia Modules Helper provides users with:
- Showing all module rows on the Modules page at once
- Updating modules, starting the newest installed versions and removing older stopped versions in bulk
- A "1-click upgrade" that runs all three steps in sequence
- A confirmation dialog listing the planned actions before anything runs, a "Stop after current action" button and a per-action log

## Permissions Used

### 1. Storage Permission (`storage`)
**Purpose:** To remember the progress of a bulk run between page reloads (every Jahia module action reloads the page) and to remember a UI preference.

**What We Store:**
- State of the bulk run in progress: selected mode, which actions were already attempted (module id, version, action type), the result log (action description and any error message shown by Jahia), step counter and timestamps
- Whether the helper panel is collapsed

**Data Location:** All data is stored locally on your device using Chrome's storage API. No data is transmitted to external servers operated by us.

### 2. Content Script on the Jahia Modules Page
**Purpose:** To display the helper panel and perform the actions you confirm.

**Where It Runs:** Only on pages whose address matches `settings.manageModules.html` (the Jahia Modules administration page).

**What We Do:** The extension reads the module names and versions shown in the Modules table and, only after you confirm, submits the same forms that the page's own buttons submit (update, start, undeploy). These requests go to your own Jahia server, exactly as if you clicked the buttons yourself, using your existing Jahia session.

The extension requests no host permissions and makes no network requests of its own.

## Data Collection and Usage

### What Data We Collect
- **NO personal information is collected**
- **NO browsing history is collected**
- **NO user identifiers or credentials are collected**
- **NO analytics or tracking data is collected**

### What Data We Store Locally
- Bulk-run progress and result log (module ids, versions, action types, Jahia error messages)
- Panel collapsed / expanded preference

All stored data remains on your local device and is never transmitted to any third-party servers.

### Third-Party Services
The extension does not use or contact any third-party services.

## Data Retention

- **Bulk-Run State:** Deleted as soon as the run finishes or is stopped; a run left unfinished for more than 5 minutes is discarded the next time the Modules page is opened
- **User Preferences:** Stored until you uninstall the extension
- **All Data Removal:** Uninstalling the extension removes all locally stored data

## Security

- All data is stored locally using Chrome's storage API
- No remote logging or data transmission to external servers
- No remote code is loaded; all code is bundled with the extension
- No authentication or user accounts required
- No cookies are set by this extension

## Intended Use

This extension is designed for administrators of Jahia servers. Module actions it performs (update, start, undeploy) change the configuration of the Jahia server you are logged in to.

**Important:** Users are responsible for ensuring they are authorized to manage modules on the server and for reviewing the planned actions before confirming a run.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Data Sharing

We do not share, sell, rent, or trade any data with third parties. There are no third-party analytics, advertising, or tracking services integrated into this extension.

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- Applicable data protection regulations

## Disclaimer

This extension is provided "as is" without warranty of any kind. The developers are not responsible for any damage caused by its use, including unintended module updates or removals. Always review the planned actions before confirming, and back up your server where appropriate.
