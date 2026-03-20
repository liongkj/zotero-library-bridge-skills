---
name: arxiv-latex-source
description: Retrieve arXiv LaTeX source bundles, extract structured sections/equations/references, and attach parsing-ready outputs to Zotero items. Use this whenever a user needs better-than-PDF full text for preprints, equation fidelity, or reproducible section-level extraction.
---

# arXiv LaTeX Source

Use arXiv source archives when PDF extraction is too noisy for formulas, references, or section boundaries.

## Core endpoint

- Download source bundle: `GET https://arxiv.org/e-print/{arxiv_id}`
- Typical response: gzip tarball containing `.tex`, figures, and bibliography files.
- Pair metadata when needed: `https://export.arxiv.org/api/query?id_list={arxiv_id}`.

## Zotero-focused workflow

1. Start from a Zotero item with `arXiv` ID, DOI that resolves to arXiv, or arXiv URL.
2. Download the e-print bundle and detect whether it is `tar.gz` or a single gzipped `.tex`.
3. Find main TeX file via `\\documentclass` + `\\begin{document}`.
4. Extract section titles, equation blocks, and bibliography entries.
5. Save parsed artifacts as a Zotero note/attachment summary and keep source provenance (`arxiv_id`, version, fetch date).

## Practical extraction targets

- **Sections**: `\\section`, `\\subsection`, `\\subsubsection`.
- **Equations**: display math (`\\[ ... \\]`), `equation`, `align` environments.
- **References**: `.bib` BibTeX keys and `.bbl` `\\bibitem` entries.
- **Figure/table cues**: `\\caption{...}`, `\\label{...}` for downstream linking.

## Guardrails

- Respect arXiv automation guidance: use a descriptive `User-Agent`.
- Keep request rate conservative (about `1 req/s`; do not exceed published limits).
- Retain raw archive hash/version where possible for reproducibility.

## Output template

```json
{
  "arxiv_id": "string",
  "source_version": "v1|v2|unknown",
  "main_tex": "path or null",
  "sections": ["string"],
  "equation_count": 0,
  "reference_count": 0,
  "zotero_actions": [
    "create_note",
    "attach_parsed_summary"
  ]
}
```
