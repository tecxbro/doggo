# Datto

Datto is a small, one-event dog matchmaking experiment over iMessage. Photon Spectrum receives and sends messages, one Node 22 service runs the matchmaker agent, NVIDIA Nemotron 3 Ultra on OpenRouter produces short structured replies and profile extraction, and Convex stores profiles, messages, dog photos, and human-created matches.

There is no automatic matching or custom admin dashboard. The event team reviews profiles, updates `humanStatus` and `humanNotes`, and creates `matches` directly in the Convex dashboard.

## Architecture

```text
iMessage user
  ↕
Photon Spectrum managed lines
  ↕
agent/ (one persistent Node service)
  ↕
Convex (profiles, messages, photos, matches)
  ↕
OpenRouter (structured matchmaker response)
```

Photon discovers the project’s managed iMessage lines from the Spectrum project credentials. The service does not allocate or hardcode a phone number.

## Setup

Install dependencies and connect the Convex project:

```bash
npm install
npx convex dev
cp agent/.env.example agent/.env
```

Generate one random service secret and set the same value in Convex and `agent/.env`:

```bash
openssl rand -hex 32
npx convex env set AGENT_SHARED_SECRET
```

Add these values to `agent/.env`:

- `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` from Photon
- `CONVEX_URL` printed by Convex
- `AGENT_SHARED_SECRET`, matching the Convex environment variable
- `OPENROUTER_API_KEY` from OpenRouter
- optional `OPENROUTER_MODEL` and `PORT`

The legacy names `PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET` are accepted, but the standard Spectrum names are preferred.

`OPENROUTER_MODEL` defaults to `nvidia/nemotron-3-ultra-550b-a55b:free`. Datto requests high reasoning and strict structured JSON output. You may override the model without changing the code.

Review the selected model provider’s data-use terms before a real-user launch because event messages may contain user-submitted names, general locations, and availability.

Run repository checks, then start the agent:

```bash
npm run check
npm run dev --workspace datto-agent
```

The health endpoint is `GET /health` on `PORT`. A `200` response means Spectrum initialization completed; `503` means the process is still starting.

## Deploy Convex

After selecting or creating the production deployment, set its service secret and deploy:

```bash
npx convex env set --prod AGENT_SHARED_SECRET
npx convex deploy
```

For non-interactive deployment, set `CONVEX_DEPLOY_KEY` before running `npx convex deploy`.

## Build and run the container

```bash
docker build -t datto-agent ./agent
docker run --rm --env-file agent/.env -p 3000:3000 datto-agent
```

The same image can run on any persistent Node/container host. The container runs as the unprivileged `node` user and includes a health check.

## Checks

```bash
npm run typecheck
npm run convex:typecheck
npm test
npm run check
docker build -t datto-agent ./agent
```

GitHub Actions runs TypeScript checks, unit tests, a production dependency audit, and a Docker build. CodeQL separately scans JavaScript and TypeScript changes. CI does not contact Photon, Convex, or OpenRouter and therefore needs no production secrets.

## Data and safety

- Convex agent functions require `AGENT_SHARED_SECRET`; never expose it to a browser or commit it.
- Exact home addresses should not be requested or stored.
- Text input is capped at 4,000 characters.
- Dog photos are capped at 10 MB and restricted to common raster photo formats; SVG is rejected.
- Convex file URLs are bearer URLs. Share them only with event staff and delete event data when it is no longer needed.

See [SECURITY.md](SECURITY.md) for reporting and operational guidance.
