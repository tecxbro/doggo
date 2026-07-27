# Datto

Datto is a small, one-event dog matchmaking experiment over iMessage. Photon Spectrum receives and sends messages, a Node 22 service runs the conversation agent, OpenAI produces short structured replies and profile extraction, and Convex stores profiles, messages, photos, and human-created matches.

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
- `OPENAI_API_KEY`
- optional `OPENAI_MODEL` and `PORT`

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
