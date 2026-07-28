# Security

Datto is a small event experiment, but it handles phone-linked conversations and dog photos. Treat the data as private event data.

## Reporting

Please report vulnerabilities privately to the repository owner instead of opening a public issue containing personal data, credentials, or a working exploit.

## Secrets

The agent requires:

- `SPECTRUM_PROJECT_SECRET`
- `OPENROUTER_API_KEY`
- `AGENT_SHARED_SECRET`

Store them only in the deployment provider and Convex environment settings. Never place real values in `.env.example`, GitHub Actions YAML, screenshots, logs, or issues.

`AGENT_SHARED_SECRET` must be at least 32 characters and must have the same value in the agent deployment and the corresponding Convex deployment. Rotate it after accidental exposure.

## Public Convex surface

Convex functions are public endpoints by default. Every function used by the external Node agent validates `AGENT_SHARED_SECRET` before reading or writing data. New externally callable Convex functions must add equivalent access control and runtime argument validation.

## Personal data

- Do not request exact home addresses.
- Do not log phone numbers or raw message bodies.
- Limit access to the Convex dashboard to event staff.
- Delete profiles, conversations, matches, and stored photos after the event retention period.
- Convex file URLs act as bearer URLs and can be reshared by anyone who receives one.

## Input and dependency controls

- Text messages are limited to 4,000 characters before LLM processing.
- Images are limited to 10 MB and common raster photo MIME types.
- SVG is rejected.
- OpenRouter responses are validated against a strict schema before use.
- GitHub Actions runs tests, type checks, a production dependency audit, a container build, and CodeQL scanning.

## Deployment

Run the agent as a non-root container user. Expose only the health endpoint publicly. Do not expose a debug endpoint, environment dump, or Convex service secret through the web application.
