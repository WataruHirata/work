# Repository-local mock database

The application defaults to PGlite, a PostgreSQL-compatible database persisted at `.local/mock-db`. Start with Node.js 22:

```powershell
npm ci
npm run dev
```

No Supabase project, Docker, CLI login, API keys, or `.env.local` file is required for local application development. The first database access applies the versioned SQL under `supabase/migrations`, then loads fictional records into the same business tables used by Supabase. Changes persist across application restarts. `.local/` is ignored by Git.

All demo accounts use the development-only password documented in the repository README. The fictional account emails end in `@example.invalid`. The `DEMO-001` station connection code in the README is also seeded locally. Integration jobs are handled by a mock transport and never call external systems.

Provider selection lives in `src/server/container.ts`. To opt into Supabase, set `DATABASE_PROVIDER=supabase` and provide the server/local values from `.env.example`; Supabase sessions, queries, and integrations then use the existing adapters. The development server does not apply remote migrations automatically. Review the migration plan and explicitly run `npm run db:migrate:check` followed by `npm run db:migrate` only for a developer-owned project.

The mock database reuses the production business schema and SQL functions rather than maintaining a second set of mock business tables. This keeps fixture records aligned with the integrated requirements and lets the app switch providers without changing routes or use cases.
