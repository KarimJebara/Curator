# Detection rules

How curator's deterministic stages decide what to flag. No LLM is involved at this layer; everything here is auditable.

## Cluster detection

A pair of skills is considered overlapping when their composite similarity score is above the threshold (default `0.20`):

```
similarity(a, b) = 0.6 * cosine(body_tf(a), body_tf(b))
                 + 0.25 * jaccard(name+desc tokens of a, b)
                 + 0.15 * name_overlap(a.name, b.name)
```

Cluster membership uses single-link clustering: a skill joins a cluster if it's similar enough to *any* member. This is intentional — overlapping skills often chain (A↔B and B↔C, but A only weakly relates to C). Single-link captures the chain.

Singletons (clusters of size 1) are filtered out before reporting.

The cluster's label is the most common name token across members.

## MCP duplicate detection

Two MCP servers are duplicates if they share the same `command` and the same first non-flag argument. This catches the common case of importing the same server under two names (e.g. `context7` and `context7-dup`). False positives (two different servers from the same package) are reported as a group, not auto-merged.

## MCP token cost estimation

We approximate per-server overhead from the config envelope:

```
tokens = max(200, estimateTokens(JSON envelope) * 4)
```

The 200-token floor accounts for handshake overhead. Multiplying by 4 is a rough scale-up to account for tool schema content we don't yet probe live (a Phase 2 enhancement).

For real workloads this is conservative on the low end; users with many tools per server can multiply by 2-3 to estimate the true cost.

## Skill version drift

Skills with names matching `-(v\d+|enhanced|agentic|new|latest|old|backup|copy|bak)$` are flagged. These suffixes nearly always indicate copies that survived a re-import.

## Orphan memory files

Files in `~/.claude/memory/` that are not referenced by `MEMORY.md`'s index links are flagged. The reference parser is intentionally simple (looks for `(filename.md)` patterns), which makes false negatives rare.

## Token estimation

We use a 4-chars-per-token heuristic, accurate to within ~10% for English prose. Precise tokenization would require shipping a tokenizer; not worth the install footprint for an estimate.

## Grading scheme

Per `mcp-checkup`'s scheme:

| Tokens | Grade |
|---|---|
| ≤100 | A |
| ≤300 | B |
| ≤600 | C |
| ≤1500 | D |
| >1500 | F |
