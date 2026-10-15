# Release-output browser gate

From `web`:

```text
npm run build
npm run test:e2e:dist
```

The second command never builds or starts the development server. It serves the
existing `dist` through Vite preview on loopback port 4176, with an independent
configuration and no backend proxy. Run it after the build has completed and
sequentially with the live-browser suite (which also owns 4176). The server is
strict about port ownership and does not reuse another process.

The suite checks:

- all three built HTML entry points and SPA deep-link fallback use fingerprinted
  JavaScript, not development source;
- failed/successful login, exact canonical request shape, authorization headers,
  session restoration at the same path/query/hash and logout;
- a real page chunk is requested only after navigation, then its dialog supports
  Escape/focus restoration and a canonical mocked create request;
- real fingerprinted page/workspace chunk requests are aborted, recovery UI
  appears, page failure preserves shell navigation, and restoring the resource
  followed by the application's reload control recovers the authenticated route;
- a built showcase detail template is interactive;
- preview source/traversal URLs do not disclose workspace source.

Every browser API request is fulfilled locally. Unexpected API, external origin,
or write requests fail the test; they never reach a business service. The data,
credentials, and token are fictional. Trace/screenshot output is under
`test-results/dist` and uploaded by the existing failed-browser artifact step.

This complements development E2E and real MySQL/Redis integration. It validates
the build's browser behavior and Vite preview's SPA serving, not a production
reverse proxy, CDN cache headers, real backend authorization, or zero-downtime
deployment. Native module failures may remain cached for one document, so the
resource recovery contract deliberately exercises the visible full-reload
action rather than assuming retry can evict the browser module cache.
