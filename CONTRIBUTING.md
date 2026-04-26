# Contributing to curator

Thanks for your interest. A few ground rules.

## Contributor License Agreement

All contributors must sign the CLA before their PR can be merged. The CLA bot
will comment on your first PR with a one-click signing link. This protects the
project: it lets us relicense or move code into separate distributions later
without needing to re-contact every past contributor.

The CLI itself is and will always remain MIT.

## Development setup

```bash
git clone https://github.com/<owner>/curator
cd curator
node tests/run-all.js
```

No build step. No bundler. Plain ESM Node.

## Code style

Follow the file structure in `src/` — many small files, single responsibility.
Functions under 50 lines. No mutation of inputs; return new objects.

## Tests

Every PR must include tests. We aim for 80%+ coverage. Use the fixtures in
`tests/fixtures/` for end-to-end scenarios. Mock LLM calls in tests; never
hit the real API in CI.

## Commits

Format: `<type>: <description>` where type is feat, fix, refactor, docs, test,
chore, perf, ci. Keep subject under 72 chars.
