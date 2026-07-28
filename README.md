# Datto

Datto is a small, one-event dog matchmaking experiment over iMessage. Photon Spectrum receives and sends messages, a Node 22 service runs the conversation agent, NVIDIA Nemotron 3 Ultra on OpenRouter produces short structured replies and profile extraction, and Convex stores profiles, messages, photos, and human-created matches.

There is no automatic matching or custom admin dashboard. The event team reviews profiles, updates `humanStatus` and `humanNotes`, and creates `matches` directly in the Convex dashboard.

## Setup

```bash
npm install
npx convex dev
npx convex codegen
cp agent/.env.example agent/.env
```

Add the values in `agent/.env`:

- `PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET` from Photon
- `CONVEX_URL` printed by Convex
- `OPENROUTER_API_KEY` from OpenRouter
- optional `OPENROUTER_MODEL` and `PORT`

`OPENROUTER_MODEL` defaults to `nvidia/nemotron-3-ultra-550b-a55b:free`. Datto requests high reasoning and strict structured JSON output. You may override the model without changing the code.

The NVIDIA free endpoint is appropriate for development and event testing, but its terms warn against sending personal or confidential information and state that prompts and responses may be logged. Datto messages can contain names, general locations, and availability, so review the provider data policy before a real-user launch and choose a production endpoint whose privacy terms fit the event.

Run checks and the service:

```bash
npm run typecheck
npm run build
npm run dev --workspace datto-agent
```

The health endpoint is `GET /health` on `PORT`.

## Deploy Convex

After selecting or creating the production deployment:

```bash
npx convex deploy
```

For non-interactive deployment, set `CONVEX_DEPLOY_KEY` before running the same command. Convex deployment regenerates the backend types before it pushes the schema and functions.

## Build and run the container

```bash
docker build -t datto-agent ./agent
docker run --rm --env-file agent/.env -p 3000:3000 datto-agent
```

The same image can run on any persistent container host. Photon manages the shared iMessage lines; this service does not allocate or hardcode a phone number.
