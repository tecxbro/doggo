# Security

Datto is a small event experiment, but it handles phone-linked conversations and dog photos. Treat the data as private event data.

## Reporting

Please report vulnerabilities privately to the repository owner instead of opening a public issue containing personal data, credentials, or a working exploit.

## Secrets

The agent requires:

- `SPECTRUM_PROJECT_SECRET`
- `OPENROUTER_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_DRIVE_FOLDER_ID`

Store real values only in the deployment provider’s secret manager. Never place them in `.env.example`, GitHub Actions YAML, screenshots, logs, issues, or committed JSON files.

The Google service-account key grants access to every resource shared with that identity. Give it access only to the Datto spreadsheet and photo folder, and rotate or delete the key after accidental exposure.

## Google Workspace access

- Use a dedicated service account, not a personal email address, as the application identity.
- Restrict the spreadsheet and Shared Drive folder to event staff and the service account.
- Keep dog photos inside a Shared Drive folder; service accounts cannot own ordinary My Drive files.
- Do not publish Drive files with `anyone with the link` permissions.
- Remove the service account from the spreadsheet and Shared Drive after the event.

## Personal data

- Do not request exact home addresses.
- Do not log phone numbers or raw message bodies.
- Delete profiles, conversations, matches, and stored photos after the event retention period.
- Treat spreadsheet IDs, Drive file IDs, and photo links as private operational data.

## Input and dependency controls

- Text messages are limited to 4,000 characters before LLM processing.
- Images are limited to 10 MB and common raster photo MIME types.
- SVG is rejected.
- OpenRouter responses are validated against a strict schema before use.
- GitHub Actions runs tests, type checks, a production dependency audit, a container build, and CodeQL scanning.

## Deployment

Run the agent as a non-root container user. Expose only the health endpoint. Do not expose a debug endpoint, environment dump, Google private key, or provider credential through the web application.
