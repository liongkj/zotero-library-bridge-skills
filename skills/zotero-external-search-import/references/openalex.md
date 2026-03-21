# OpenAlex Search Contract

Use OpenAlex as the default discovery source for paper search unless a request clearly requires a source-specific fallback.

## Discovery defaults

- Use OpenAlex `works` search as the first pass for topic queries, title lookups, and DOI resolution.
- Apply year filters when the user specifies date limits.
- Prefer records with DOI, abstract, and venue metadata when ranking candidates.
- Fall back to non-OpenAlex lookup only when:
  - OpenAlex misses a clearly known paper
  - DOI/title resolution remains ambiguous
  - the request is source-specific (`PMCID`, `arXiv`, repository-only)

## Canonical intermediate shape

Normalize OpenAlex results into this intermediate shape before Zotero import mapping:

```json
{
  "openalex_id": "https://openalex.org/W...",
  "title": "string",
  "authors": ["string"],
  "journal": "string or null",
  "year": 2024,
  "doi": "10.xxxx/xxxx or null",
  "abstract": "string or null",
  "url": "string or null",
  "pdf_url": "string or null",
  "source": "openalex",
  "oa_status": "gold|green|hybrid|bronze|closed|unknown",
  "primary_location_url": "string or null",
  "relevance_inputs": {
    "title_match": "high|medium|low",
    "abstract_match": "high|medium|low",
    "has_doi": true,
    "is_recent": true
  }
}
```

## OpenAlex to Zotero record mapping

- `display_name` or `title` -> `title`
- `authorships[].author.display_name` -> `authors`
- `primary_location.source.display_name` or `host_venue.display_name` -> `journal`
- `publication_year` -> `year`
- canonical DOI without `https://doi.org/` prefix -> `doi`
- reconstructed abstract from `abstract_inverted_index` -> `abstract`
- `primary_location.landing_page_url` -> `url`
- `primary_location.pdf_url` or best OA PDF candidate -> `pdf_url`
- constant `openalex` -> `source`

## Ranking defaults

Rank candidates in this order unless the user specifies a different priority:

1. Strong title/keyword match
2. Strong abstract or mechanistic relevance
3. Records within requested year range or most recent records
4. DOI-present records over DOI-missing records
5. More complete venue/authorship metadata over sparse records

## Deduplication defaults

- Deduplicate by DOI first.
- If DOI is missing, use normalized title + publication year.
- Keep the record with the richest metadata when duplicates remain.

## Fallback expectations

- If OpenAlex returns incomplete metadata, keep uncertainty notes in `relevance_reason`.
- If OpenAlex misses a known paper, try DOI/title resolution outside OpenAlex and still emit the standard Zotero record shape.
- If OA/full-text candidates are present, prefer import with `fetch_full_text=true` unless the user explicitly requested metadata-only import.
