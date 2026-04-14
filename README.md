# Amonzi

Web-first full-stack starter inspired by the WindSwipe template.

The project is split into:

- `src/server` for the Django API
- `src/client` for the React app

The frontend is built mobile-first so it works well in the browser on phones, tablets, and desktop. Later, the same client can be wrapped for iOS, Android, and desktop without changing the core app structure.

## Setup

```bash
make install
```

For Google-only sign-in, add Firebase web config to `src/client/.env`.
You can copy `src/client/template.env` and fill in the values from your Firebase project.

## Development

Run these in separate terminals:

```bash
make server
```

```bash
make client
```

- API: `http://localhost:8000/api/health/`
- UI: `http://localhost:5173`
- OpenAPI schema: `http://localhost:8000/api/schema/`

## Quality

```bash
make quality
make test
```
