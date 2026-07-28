# Datto

Datto is a small, one-event dog matchmaking experiment over iMessage. Photon Spectrum receives and sends messages, one Node 22 service runs the matchmaker agent, NVIDIA Nemotron 3 Ultra on OpenRouter produces short structured replies and profile extraction, and Google Sheets plus Google Drive hold the event data.

There is no automatic matching or custom admin dashboard. The event team reviews and edits the `Profiles`, `Messages`, and `Matches` tabs directly in Google Sheets.

## Architecture

```text
iMessage user
  ↕
Photon Spectrum managed lines
  ↕
agent/ (one persistent Node service)
  ↕
Google Sheets (profiles, messages, matches)
Google Drive (dog photos)
  ↕
OpenRouter (structured matchmaker response)
```

Photon discovers the project’s managed iMessage lines from the Spectrum project credentials. The service does not allocate or hardcode a phone number.

## Google setup

`golchhad@uci.edu` can own the spreadsheet and Shared Drive, but it is a human Google account, not a service account. Create a separate service account in Google Cloud; its email will look like `datto-agent@your-project.iam.gserviceaccount.com`.

1. Create or select a Google Cloud project.
2. Enable the Google Sheets API and Google Drive API.
3. Create a service account and download one JSON key.
4. Create a blank Google Sheet. Datto creates and maintains the `Profiles`, `Messages`, and `Matches` tabs automatically.
5. Create a folder inside a Google Shared Drive for dog photos. A service account cannot own ordinary My Drive files, so a normal My Drive folder is not sufficient for this configuration.
6. Share the spreadsheet with the service-account email as Editor.
7. Give the service account access to the Shared Drive folder.
8. Copy the spreadsheet ID from the Sheet URL and the folder ID from the Drive URL.

Delete the downloaded JSON key after its values have been placed in your deployment secret manager. Never commit the JSON file.

## Environment variables

Copy the example file for local development:

```bash
npm install
cp agent/.env.example agent/.env
```

Set:

```env
SPECTRUM_PROJECT_ID=
SPECTRUM_PROJECT_SECRET=
GOOGLE_SERVICE_ACCOUNT_EMAIL=datto-agent@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=
GOOGLE_DRIVE_FOLDER_ID=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
PORT=3000
```

Use the `client_email` and `private_key` fields from the service-account JSON. `GOOGLE_PRIVATE_KEY` accepts either real line breaks or escaped `\n` sequences.

Review the selected model provider’s data-use terms before a real-user launch because event messages may contain user-submitted names, general locations, and availability.

## Run locally

```bash
npm run check
npm run dev --workspace datto-agent
```

The health endpoint is `GET /health` on `PORT`. A `200` response means both Google storage and Photon Spectrum initialized successfully; `503` means the process is still starting.

## Deploy on Northflank

Create one service from this repository with:

```text
Build context: agent
Dockerfile: agent/Dockerfile
Port: 3000
Health check: /health
```

Add every variable from `agent/.env.example` in Northflank’s environment-variable or secret settings. Do not upload the service-account JSON file to the repository.

## Spreadsheet layout

`Profiles` contains one row per Spectrum user, including the extracted dog profile, Drive photo links, profile completion, human status, and notes.

`Messages` contains one row per inbound or outbound message. `spectrum_message_id` is used for deduplication.

`Matches` is intentionally human-operated. Add the two profile user IDs, status, notes, and timestamps directly in the sheet.

## Checks

```bash
npm run typecheck
npm test
npm run check
docker build -t datto-agent ./agent
```

GitHub Actions runs TypeScript checks, unit tests, a production dependency audit, a Docker build, and CodeQL. CI does not contact Photon, Google, or OpenRouter and therefore needs no production secrets.

## Data and safety

- Do not request or store exact home addresses.
- Text input is capped at 4,000 characters.
- Dog photos are capped at 10 MB and restricted to common raster photo formats; SVG is rejected.
- Restrict the spreadsheet and Shared Drive to event staff and the service account.
- Delete event messages and photos after the retention period.

See [SECURITY.md](SECURITY.md) for reporting and operational guidance.
