---
name: open-access-guide
description: Determine legal open-access routes for a paper, identify the best full-text location, and record version/license decisions for Zotero import and citation workflows. Use this whenever a user asks how to get a full text legally or where to self-archive.
---

# Open Access Guide

Find lawful full text quickly, then document what was found and why it is reusable.

## What this skill handles

- Check OA status for DOI-based items (for example with Unpaywall/OpenAlex signals).
- Prioritize stable legal sources: publisher OA page, repository copy, then preprint.
- Distinguish manuscript versions: preprint, accepted manuscript (postprint), version of record.
- Capture reuse terms (license, embargo, repository policy) for Zotero notes.

## Zotero-focused workflow

1. Read item metadata (title, DOI, journal, year, ISSN if available).
2. Resolve OA locations and pick best link by legality + completeness.
3. Record `version`, `license`, and `source_url` in a structured Zotero note.
4. If closed access, suggest Green OA path (self-archiving policy + embargo check).
5. Tag item for downstream handling, for example `oa-available`, `green-oa`, `rights-check-needed`.

## Source priority order

1. Publisher-hosted OA with explicit open license.
2. Trusted repositories (`PMC`, `arXiv`, institutional repositories, Zenodo).
3. Aggregator-discovered repository links (verify final host and license).

## Rights checklist

- Confirm article version before attaching to Zotero.
- Capture license string when present (for example `CC BY 4.0`).
- Respect embargo dates for accepted manuscripts.
- Store evidence URL in note for auditability.

## Output template

```json
{
  "doi": "string or null",
  "is_oa": true,
  "oa_status": "gold|green|hybrid|bronze|closed|unknown",
  "best_url": "string or null",
  "version": "published|accepted|submitted|unknown",
  "license": "string or null",
  "embargo": "string or null",
  "zotero_tags": ["oa-available"],
  "next_action": "attach|policy-check|manual-review"
}
```
