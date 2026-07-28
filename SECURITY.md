# Security

Datto is a small event experiment, but it handles phone-linked conversations and dog photos. Treat the data as private event data.

## Reporting

Report vulnerabilities privately to the repository owner instead of opening a public issue containing personal data, credentials, or a working exploit.

## Secrets

The agent requires these sensitive values:

- `SPECTRUM_PROJECT_SECRET`
- `OPENROUTER_API_KEY`
- `COMPOSIO_API_KEY`

Store real values only in the deployment provider’s secret manager. Never place them in `.env.example`, GitHub Actions YAML, screenshots, logs, issues, or committed configuration files.

Create a dedicated Composio deployment key with only the permissions required for sessions and Proxy Execute when the project supports scoped keys. Add an IP allowlist when the Northflank egress configuration is stable enough to support one. Rotate the key after accidental exposure.

`GOOGLE_SPREADSHEET_ID`, `GOOGLE_DRIVE_FOLDER_ID`, `COMPOSIO_USER_ID`, and optional connection IDs are not bearer credentials, but they are private operational metadata and should not be exposed unnecessarily.

## Composio and Google access

- Datto never receives Google refresh tokens or stores a Google private key; Composio manages the OAuth connection.
- The Google Sheets and Drive OAuth scopes may permit access to more than the Datto spreadsheet and photo folder.
- Prefer a dedicated event Google account rather than a primary personal or university account.
- Connect only the `googlesheets` and `googledrive` toolkits needed by Datto.
- Pin `COMPOSIO_GOOGLE_SHEETS_CONNECTION_ID` and `COMPOSIO_GOOGLE_DRIVE_CONNECTION_ID` when the Composio user has multiple Google accounts.
- Revoke both Google connections in Composio after the event or immediately after suspected compromise.
- Do not publish Drive files with `anyone with the link` permissions.

## Personal data

- Do not request exact home addresses.
- Do not log phone numbers or raw message bodies.
- Restrict the spreadsheet and photo folder to event staff.
- Delete profiles, conversations, matches, and stored photos after the event retention period.
- Treat spreadsheet IDs, Drive file IDs, and photo links as private operational data.

## Input and dependency controls

- Text messages are limited to 4,000 characters before LLM processing.
- Images are limited to 10 MB and common raster photo MIME types.
- SVG is rejected.
- OpenRouter responses are validated against a strict schema before use.
- Composio and Google errors are reduced to status and request identifiers; provider response bodies are not written to logs.
- GitHub Actions runs tests, type checks, a production dependency audit, a container build, and CodeQL scanning.

## Deployment

Run the agent as a non-root container user with one replica. Expose only the health endpoint. Do not expose a debug endpoint, environment dump, Composio API key, Spectrum secret, or OpenRouter key through the web application.
