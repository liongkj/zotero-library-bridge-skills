---
name: zotero-onboard-skill
description: Onboard user on citations manager like Zotero workflow preferences by creating or updating a reusable profile for zotero bridge components i.e. zotero-reading-classifier.
---

# Zotero Onboard Skill

Create and maintain a user workflow profile so downstream Zotero skills follow the user's own process.

## What this skill owns

- Workflow interview and preference capture.
- Creation or update of `skills/zotero-reading-classifier/user-workflow.yaml`.
- Validation of required profile fields.
- Safe profile edits over time (additive updates, no silent resets).

## When to use

- A user says "you tagged wrongly", or "onboard me".
- `zotero-reading-classifier` is requested and profile is missing or incomplete.
- User wants to change existing tags, note template, confidence policy, or collection rules.

## Output artifact

- Primary file: `skills/zotero-reading-classifier/user-workflow.yaml`
- Bootstrap source: `skills/zotero-reading-classifier/user-workflow.example.yaml`

## Onboarding flow

1. Check if profile exists.
2. If missing, start from `user-workflow.example.yaml`.
3. Ask only high-impact questions needed to proceed:
   - Tag taxonomy (core + custom tags)
   - Collection routing rules
   - Required note fields
   - Allowed where-to-cite labels
   - Confidence policy (`strict|moderate|lenient`)
   - Whether high confidence requires full text
4. Write or update profile.
5. Validate fields and types.
6. Return a concise summary of what changed.

## Validation checks

- `workflow_name` is non-empty.
- `triage_mode` is one of `fast|deep`.
- `tags.include` exists and is not empty.
- `confidence_policy.level` is one of `strict|moderate|lenient`.
- `note_template.fields` has at least 3 fields.
- `where_to_cite_labels` is non-empty.

If validation fails, report exact missing/invalid fields and propose a corrected block.

## Behavioral rules

- Never overwrite user profile silently; preserve unchanged keys.
- Prefer minimal diffs to existing profile.
- Do not mutate Zotero library items; this skill only manages workflow config.
- If user gives conflicting preferences, prioritize the latest explicit instruction.

## Handoff contract

- `zotero-reading-classifier` reads `user-workflow.yaml` first.
- `zotero-external-search-import` and `zotero-library-bridge` remain unchanged.
- Return active workflow name and effective settings after each onboarding/update run.

## Minimal profile template

```yaml
workflow_name: "my-workflow"
triage_mode: "deep"
tags:
  include: ["review", "methodology", "to-cite"]
  custom: []
collection_rules: []
confidence_policy:
  level: "moderate"
  require_full_text_for_high: true
where_to_cite_labels: ["introduction", "methods", "results", "discussion"]
note_template:
  fields: ["TL;DR", "Main contribution", "Potential citation sentence", "Where to cite", "Confidence"]
```
