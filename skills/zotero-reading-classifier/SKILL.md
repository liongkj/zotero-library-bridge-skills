---
name: zotero-reading-classifier
description: Read Zotero metadata and available full text, classify papers by research-use tags, organize collections, and generate concise citation-use notes for manuscript writing. Use this whenever the user wants literature triage, relevance scoring, tagging, grouping, or "where to cite" support from their Zotero library.
---

# Zotero Reading Classifier

Turn imported Zotero items into citation-ready knowledge by reading, classifying, organizing, and summarizing.

Use this skill after paper discovery/import when the user wants TL;DRs, relevance triage, "where to cite", or short manuscript-ready notes.

## Workflow profile overrides

Support user-specific workflows through a profile file.

- Default profile path: `skills/zotero-reading-classifier/user-workflow.yaml`
- If no profile exists, use defaults in this file.
- If profile exists, apply profile values first.
- If the user gives explicit instructions in chat, those override profile values for that run.

Precedence order:

1. Explicit user request in current prompt
2. `user-workflow.yaml` profile values
3. Skill defaults in this file

## Onboarding questions (first run)

When profile is missing or incomplete, ask only what is needed to proceed:

1. Which tags should be used for triage?
2. Which collection paths should receive each tag group?
3. Which note fields are mandatory?
4. Which citation sections should be used (`introduction`, `methods`, `results`, `discussion`)?
5. What confidence policy should be used (`strict`, `moderate`, `lenient`)?
6. Should high confidence require full text (`true` or `false`)?

After answers are provided, write/update the profile file and confirm the active workflow name.

## Default classification tags

- `radical`
- `borylation`
- `review`
- `methodology`
- `mechanism`
- `useful-introduction`
- `to-cite`

## Default profile schema

Use this schema for user overrides:

```yaml
workflow_name: "default"
triage_mode: "deep" # fast|deep
tags:
  include:
    - "radical"
    - "borylation"
    - "review"
    - "methodology"
    - "mechanism"
    - "useful-introduction"
    - "to-cite"
  custom: []
collection_rules: []
confidence_policy:
  level: "moderate" # strict|moderate|lenient
  require_full_text_for_high: true
where_to_cite_labels:
  - "introduction"
  - "method"
  - "mechanism"
  - "discussion"
note_template:
  fields:
    - "TL;DR"
    - "Main contribution"
    - "Most useful for"
    - "Potential citation sentence"
    - "Limitations"
    - "Where to cite"
    - "Confidence"
```

## Workflow

1. Read metadata and abstract first.
2. If full text is not yet available, call `zotero-library-bridge` full-text retrieval before proceeding.
3. Read attachment text when available.
4. Produce a short TL;DR grounded in abstract or attachment text.
5. Assign tags and confidence using profile rules when present.
6. Choose collection path using profile `collection_rules` when present.
7. Create short note with manuscript guidance using profile `note_template` when present.

## Cross-skill handoff

- For web discovery, start with `zotero-external-search-import`, which owns the OpenAlex-first search and import orchestration.
- For library writes and attachment access, use `zotero-library-bridge`.
- This skill owns the summarization/TL;DR step; do not assume the bridge generates summaries automatically.
- If workflow profile is missing or needs updates, call `zotero-onboard-skill` before classification.

## Note template

```text
TL;DR: ...
Main contribution: ...
Most useful for: ...
Potential citation sentence: ...
Limitations: ...
Where to cite: introduction|method|mechanism|discussion
Confidence: low|medium|high
```

If a custom template is provided in the workflow profile, use it instead of this default template.
