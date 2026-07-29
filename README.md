# DoggoDates

DoggoDates is a small, one-event dog matchmaking experiment over iMessage. Photon Spectrum receives and sends messages, one persistent Node 22 service runs the matchmaker agent, NVIDIA Nemotron 3 Ultra on OpenRouter produces short structured replies and profile extraction, and Composio supplies managed Google OAuth for Google Sheets and Google Drive.

There is no automatic matching or custom admin dashboard. The event team reviews and edits the `Profiles`, `Messages`, and `Matches` tabs directly in Google Sheets.

## Architecture

```text
iMessage user
  ↕
Photon Spectrum managed lines
  ↕
DoggoDates agent on Northflank
  ↕
Composio managed Google OAuth
  ↕
Google Sheets (profiles, messages, matches)
Google Drive (dog photos)
  ↕
OpenRouter (structured matchmaker response)
```

Photon discovers the project’s managed iMessage lines from the Spectrum project credentials. The service does not allocate or hardcode a phone number.

## Create the Google resources

1. Create one blank Google Sheet, for example `DoggoDates Event Database`.
2. Create one Google Drive folder, for example `DoggoDates Dog Photos`.
3. Copy the spreadsheet ID from the Sheet URL and the folder ID from the Drive URL.

The folder may be in ordinary My Drive because Composio uses your OAuth-authorized Google account rather than a service account. DoggoDates creates and maintains the `Profiles`, `Messages`, and `Matches` tabs automatically.

Use a dedicated event Google account when possible. The Google OAuth scopes used by the Sheets and Drive toolkits may allow access beyond these two DoggoDates resources.

## Connect Google through Composio

1. Create a Composio project and API key at `https://platform.composio.dev/`.
2. The deployment API key must be allowed to create and use sessions and perform Proxy Execute requests.
3. Install dependencies.
4. Export the API key and a stable Composio user ID.
5. Run the connection helper.

```bash
npm install
export COMPOSIO_API_KEY='your-project-api-key'
export COMPOSIO_USER_ID='doggodates-admin'
npm run composio:connect --workspace doggodates-agent
```

Open every authorization URL printed by the command and sign in to the Google account that owns the DoggoDates spreadsheet and photo folder. The helper connects both the `googlesheets` and `googledrive` toolkits under the same Composio user ID.

If that Composio user has only one active account for each toolkit, no connection IDs are required. When multiple Google accounts are connected, set the optional connection IDs so the deployment cannot select the wrong account.

## Environment variables

Copy the example file for local development:

```bash
cp agent/.env.example agent/.env
```

Set:

```env
SPECTRUM_PROJECT_ID=
SPECTRUM_PROJECT_SECRET=

COMPOSIO_API_KEY=
COMPOSIO_USER_ID=doggodates-admin
COMPOSIO_GOOGLE_SHEETS_CONNECTION_ID=
COMPOSIO_GOOGLE_DRIVE_CONNECTION_ID=

GOOGLE_SPREADSHEET_ID=
GOOGLE_DRIVE_FOLDER_ID=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
PORT=3000
```

`COMPOSIO_GOOGLE_SHEETS_CONNECTION_ID` and `COMPOSIO_GOOGLE_DRIVE_CONNECTION_ID` are optional. Leave them blank when exactly one active connection exists for each toolkit. The legacy names `PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET` remain accepted.

DoggoDates uses Composio Tool Router sessions with the sandbox disabled. Google API requests go through Composio Proxy Execute so the agent never receives or stores Google access or refresh tokens.

Review the selected OpenRouter model provider’s data-use terms before a real-user launch because event messages may contain user-submitted names, general locations, and availability.

## Run locally

```bash
npm run check
npm run dev --workspace doggodates-agent
```

The health endpoint is `GET /health` on `PORT`. A `200` response means Composio-backed Google storage and Photon Spectrum both initialized successfully; `503` means the process is still starting.

## Deploy on Northflank

Create one combined service from this repository after renaming it to `tecxbro/doggodates`:

```text
Repository: tecxbro/doggodates
Branch: main
Build context: agent
Dockerfile inside build context: Dockerfile
Port: 3000
Health check: /health
Replicas: 1
```

Add every variable from `agent/.env.example` through Northflank runtime variables or a secret group. Do not put credentials in Docker build arguments or commit a real `.env` file.

Use one replica for the event so only one persistent process consumes the Photon message stream and writes to the spreadsheet.

## Spreadsheet layout

`Profiles` contains one row per Spectrum user, including the extracted dog profile, Drive photo links, profile completion, human status, and notes.

`Messages` contains one row per inbound or outbound message. `spectrum_message_id` is used for deduplication.

`Matches` is intentionally human-operated. Add the two profile user IDs, status, notes, and timestamps directly in the sheet.

## Checks

```bash
npm run typecheck
npm test
npm run check
docker build -t doggodates-agent ./agent
```

GitHub Actions runs TypeScript checks, unit tests, a production dependency audit, a Docker build, and CodeQL. CI does not contact Photon, Composio, Google, or OpenRouter and therefore needs no production credentials.

## Data and safety

- Do not request or store exact home addresses.
- Text input is capped at 4,000 characters.
- Dog photos are capped at 10 MB and restricted to common raster photo formats; SVG is rejected.
- Use a dedicated or minimally privileged Google account for the Composio connection.
- Restrict the spreadsheet and photo folder to event staff.
- Revoke the Composio Google connections and delete event messages and photos after the retention period.

See [SECURITY.md](SECURITY.md) for reporting and operational guidance.
