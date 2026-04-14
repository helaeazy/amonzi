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

For now you can keep auth disabled with `VITE_DISABLE_AUTH=true` in `src/client/.env`.
When you want Google-only sign-in, set `VITE_DISABLE_AUTH=false` and fill in the Firebase web config from `src/client/template.env`.

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
