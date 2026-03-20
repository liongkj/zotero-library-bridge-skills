---
name: zotero-reading-classifier
description: Read Zotero metadata and available full text, classify papers by research-use tags, organize collections, and generate concise citation-use notes for manuscript writing. Use this whenever the user wants literature triage, relevance scoring, tagging, grouping, or "where to cite" support from their Zotero library.
---

# Zotero Reading Classifier

Turn imported Zotero items into citation-ready knowledge by reading, classifying, organizing, and summarizing.

## Default classification tags

- `radical`
- `borylation`
- `review`
- `methodology`
- `mechanism`
- `useful-introduction`
- `to-cite`

## Workflow

1. Read metadata and abstract first.
2. If full text is available, read attachment text.
3. Assign tags and confidence.
4. Choose collection path.
5. Create short note with manuscript guidance.

## Note template

```text
Main contribution: ...
Most useful for: ...
Potential citation sentence: ...
Limitations: ...
Where to cite: introduction|method|mechanism|discussion
Confidence: low|medium|high
```
