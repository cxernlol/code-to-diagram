## Summary
- 

## Scope
- [ ] Single-purpose change (no unrelated edits to web app, `mcp/`, or workflows)
- [ ] Preserves local-first privacy, API key isolation, and IndexedDB/migration compatibility

## Verification
- [ ] `npm run build`
- [ ] `npm run mcp:test` (if `mcp/` or `src/lib/` changed)
- [ ] `npx playwright test --workers=1` (if web app changed)
