# Privacy Policy for XSS Helper

**Last Updated:** December 3, 2025

## Introduction

XSS Helper is a Chrome extension designed to help security researchers and web developers by providing quick access to XSS (Cross-Site Scripting) payload lists for testing purposes. This extension is intended for authorized security testing, penetration testing, and educational purposes only.

## Purpose of the Extension

XSS Helper provides users with:
- Quick access to XSS payload lists from the open-source repository [payloadbox/xss-payload-list](https://github.com/payloadbox/xss-payload-list)
- Ability to copy random or all XSS payloads to clipboard for security testing
- Option to use either GitHub-hosted payload lists or local payload lists
- Caching functionality to reduce network requests and improve performance

## Permissions Used

### 1. Storage Permission (`storage`)
**Purpose:** To cache XSS payload lists and user preferences locally.

**What We Store:**
- Downloaded XSS payload lists (cached for 24 hours)
- Timestamp of last payload fetch
- User preference for payload source (GitHub or local)

**Data Location:** All data is stored locally on your device using Chrome's storage API. No data is transmitted to external servers operated by us.

### 2. Clipboard Write Permission (`clipboardWrite`)
**Purpose:** To copy XSS payloads to your clipboard when you click the copy buttons.

**What We Do:** The extension copies the selected payload text to your clipboard only when you explicitly click the "Copy X lines" or "Copy All Lines" buttons.

### 3. Host Permissions (`https://raw.githubusercontent.com/*`)
**Purpose:** To fetch the latest XSS payload lists from the GitHub repository.

**What We Access:** When "Use payloads from GitHub" is checked, the extension makes a single HTTP GET request to download the text file from:
`https://raw.githubusercontent.com/payloadbox/xss-payload-list/master/Intruder/xss-payload-list.txt`

## Data Collection and Usage

### What Data We Collect
- **NO personal information is collected**
- **NO browsing history is collected**
- **NO user identifiers are collected**
- **NO analytics or tracking data is collected**

### What Data We Store Locally
- XSS payload lists (text content only)
- Cache timestamp
- User preference (GitHub vs local source)

All stored data remains on your local device and is never transmitted to any third-party servers.

### Third-Party Services
The only external service accessed is GitHub's raw content delivery for fetching payload lists:
- **Service:** GitHub (raw.githubusercontent.com)
- **Purpose:** Download open-source XSS payload list
- **Data Sent:** None (standard HTTP GET request only)
- **Frequency:** Once per 24 hours when "Use payloads from GitHub" is enabled

## Data Retention

- **Cached Payloads:** Automatically refreshed every 24 hours
- **User Preferences:** Stored indefinitely until you uninstall the extension
- **All Data Removal:** Uninstalling the extension removes all locally stored data

## Security

- All payload lists are stored locally using Chrome's secure storage API
- No remote logging or data transmission to external servers (except GitHub for payload downloads)
- No authentication or user accounts required
- No cookies are set by this extension

## Intended Use

This extension is designed for:
- **Authorized security testing** with proper permission
- **Web application penetration testing** on systems you own or have explicit permission to test
- **Educational purposes** in controlled environments
- **Security research** in compliance with applicable laws

**Important:** Users are responsible for ensuring their use of this extension complies with all applicable laws, regulations, and terms of service. Unauthorized security testing may be illegal.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Data Sharing

We do not share, sell, rent, or trade any data with third parties. There are no third-party analytics, advertising, or tracking services integrated into this extension.

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- Google API Services User Data Policy
- Applicable data protection regulations

## Disclaimer

This extension is provided "as is" without warranty of any kind. The developers are not responsible for any misuse of the payloads or any damage caused by improper use of this tool. Always obtain proper authorization before conducting security tests.
