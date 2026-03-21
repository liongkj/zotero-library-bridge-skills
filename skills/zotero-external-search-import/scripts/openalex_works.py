#!/usr/bin/env python3
"""Query OpenAlex works and emit normalized candidates for Zotero workflows."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str | None:
    if not inverted_index:
        return None

    positions: dict[int, str] = {}
    for token, indexes in inverted_index.items():
        for index in indexes:
            positions[index] = token

    if not positions:
        return None

    return " ".join(token for _, token in sorted(positions.items()))


def strip_doi(raw_doi: str | None) -> str | None:
    if not raw_doi:
        return None

    doi = raw_doi.strip()
    prefixes = (
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
        "doi.org/",
        "dx.doi.org/",
        "doi:",
    )
    lower = doi.lower()
    for prefix in prefixes:
        if lower.startswith(prefix):
            return doi[len(prefix) :]
    return doi


def normalize_work(work: dict[str, Any]) -> dict[str, Any]:
    primary_location = work.get("primary_location") or {}
    source = primary_location.get("source") or {}
    pdf_url = primary_location.get("pdf_url")
    landing_url = primary_location.get("landing_page_url") or work.get("ids", {}).get("openalex")
    abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
    year = work.get("publication_year")

    return {
        "openalex_id": work.get("id"),
        "title": work.get("display_name") or work.get("title"),
        "authors": [
            authorship.get("author", {}).get("display_name")
            for authorship in work.get("authorships") or []
            if authorship.get("author", {}).get("display_name")
        ],
        "journal": source.get("display_name"),
        "year": year,
        "doi": strip_doi(work.get("doi")),
        "abstract": abstract,
        "url": landing_url,
        "pdf_url": pdf_url,
        "source": "openalex",
        "oa_status": work.get("open_access", {}).get("oa_status") or "unknown",
        "primary_location_url": landing_url,
        "relevance_inputs": {
            "title_match": "unknown",
            "abstract_match": "unknown",
            "has_doi": bool(work.get("doi")),
            "is_recent": bool(year and year >= 2020),
        },
    }


def build_url(
    query: str,
    year_from: int | None,
    year_to: int | None,
    limit: int,
    mailto: str | None,
) -> str:
    params = {
        "search": query,
        "per-page": str(limit),
    }
    if mailto:
        params["mailto"] = mailto

    filters: list[str] = []
    if year_from is not None:
        filters.append(f"from_publication_date:{year_from}-01-01")
    if year_to is not None:
        filters.append(f"to_publication_date:{year_to}-12-31")
    if filters:
        params["filter"] = ",".join(filters)

    return "https://api.openalex.org/works?" + urllib.parse.urlencode(params)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="OpenAlex search query")
    parser.add_argument("--year-from", type=int, default=None)
    parser.add_argument("--year-to", type=int, default=None)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument(
        "--mailto",
        default=os.getenv("OPENALEX_MAILTO", "me@liongkj.com"),
        help="Contact email for OpenAlex polite pool (default: OPENALEX_MAILTO env or me@liongkj.com)",
    )
    parser.add_argument(
        "--user-agent",
        default=os.getenv(
            "OPENALEX_USER_AGENT",
            "zotero-library-bridge-openalex-helper/0.3.3",
        ),
        help="User-Agent header (default: OPENALEX_USER_AGENT env or local helper identifier)",
    )
    args = parser.parse_args()

    url = build_url(args.query, args.year_from, args.year_to, args.limit, args.mailto)
    request = urllib.request.Request(url, headers={"User-Agent": args.user_agent})

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        print(
            f"OpenAlex request failed with HTTP {error.code}: {error.reason}",
            file=sys.stderr,
        )
        return 1
    except urllib.error.URLError as error:
        print(f"OpenAlex network error: {error.reason}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f"OpenAlex response was not valid JSON: {error}", file=sys.stderr)
        return 1

    if not isinstance(payload, dict):
        print("OpenAlex response JSON was not an object", file=sys.stderr)
        return 1

    results = [normalize_work(work) for work in payload.get("results") or []]
    json.dump({"records": results}, sys.stdout, indent=2, ensure_ascii=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
