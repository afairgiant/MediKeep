#!/usr/bin/env python3
"""
Sync documentation from docs/ folder to GitHub wiki.

This script reads the wiki-mapping.yml configuration and:
1. Copies mapped documentation files to the wiki directory
2. Transforms internal links to wiki-compatible format
3. Generates the _Sidebar.md for wiki navigation

Usage:
    python scripts/sync-wiki.py

Requires:
    - pyyaml package
    - wiki/ directory (cloned wiki repo)
    - docs/wiki-mapping.yml configuration
"""

import os
import re
import shutil
from pathlib import Path

import yaml


def load_config(config_path: str) -> dict:
    """Load wiki mapping configuration."""
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def transform_links(content: str, link_mappings: dict) -> str:
    """Transform internal markdown links to wiki format.

    Converts:
        [text](file.md) -> [text](Wiki-Page)
        [text](file.md#anchor) -> [text](Wiki-Page#anchor)
        [text](../path/file.md) -> [text](Wiki-Page)
    """
    # Pattern to match markdown links: [text](url)
    link_pattern = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")

    def replace_link(match):
        text = match.group(1)
        url = match.group(2)

        # Skip external links and anchors-only links
        if url.startswith(("http://", "https://", "#", "mailto:")):
            return match.group(0)

        # Extract anchor if present
        anchor = ""
        if "#" in url:
            url, anchor = url.split("#", 1)
            anchor = "#" + anchor

        # Normalize the URL for lookup
        url_normalized = url.strip()

        # Try exact match first
        if url_normalized in link_mappings:
            wiki_page = link_mappings[url_normalized]
            return f"[{text}]({wiki_page}{anchor})"

        # Try just the filename
        filename = os.path.basename(url_normalized)
        if filename in link_mappings:
            wiki_page = link_mappings[filename]
            return f"[{text}]({wiki_page}{anchor})"

        # If no mapping found, keep original but warn
        print(f"  Warning: No mapping for link '{url_normalized}'")
        return match.group(0)

    return link_pattern.sub(replace_link, content)


def remove_emojis_from_headers(content: str) -> str:
    """Optionally clean up emoji usage in headers for cleaner wiki look.

    This is optional - comment out if you want to keep emojis.
    """
    # Keep emojis for now - they're part of the doc style
    return content


def process_file(
    source_path: str, wiki_path: str, link_mappings: dict, title: str | None = None
) -> bool:
    """Process a single documentation file for the wiki.

    Returns True if file was processed successfully.
    """
    if not os.path.exists(source_path):
        print(f"  Warning: Source file not found: {source_path}")
        return False

    with open(source_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Transform internal links
    content = transform_links(content, link_mappings)

    # Optionally clean up content
    content = remove_emojis_from_headers(content)

    # Write to wiki
    os.makedirs(os.path.dirname(wiki_path), exist_ok=True)
    with open(wiki_path, "w", encoding="utf-8") as f:
        f.write(content)

    return True


def generate_sidebar(sidebar_config: list, wiki_dir: str) -> None:
    """Generate _Sidebar.md for wiki navigation."""
    lines = ["# Navigation", ""]

    for section in sidebar_config:
        section_name = section.get("section", "")
        pages = section.get("pages", [])

        if section_name:
            lines.append(f"### {section_name}")

        for page in pages:
            # Convert page name to display name
            display_name = page.replace("-", " ")
            lines.append(f"- [[{display_name}|{page}]]")

        lines.append("")  # Blank line between sections

    # Add footer
    lines.extend(
        [
            "---",
            "",
            "**Resources**",
            "- [GitHub Repository](https://github.com/afairgiant/MediKeep)",
            "- [Report an Issue](https://github.com/afairgiant/MediKeep/issues)",
            "- [Discussions](https://github.com/afairgiant/MediKeep/discussions)",
        ]
    )

    sidebar_path = os.path.join(wiki_dir, "_Sidebar.md")
    with open(sidebar_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Generated: _Sidebar.md")


def generate_footer(wiki_dir: str) -> None:
    """Generate _Footer.md for wiki pages."""
    footer_content = """---
*Documentation auto-synced from [docs/](https://github.com/afairgiant/MediKeep/tree/main/docs) folder.*

[Edit on GitHub](https://github.com/afairgiant/MediKeep) | [Report Documentation Issue](https://github.com/afairgiant/MediKeep/issues/new?labels=documentation)
"""
    footer_path = os.path.join(wiki_dir, "_Footer.md")
    with open(footer_path, "w", encoding="utf-8") as f:
        f.write(footer_content)

    print(f"Generated: _Footer.md")


def main():
    """Main sync function."""
    # Paths
    repo_root = Path(__file__).parent.parent
    config_path = repo_root / "docs" / "wiki-mapping.yml"
    wiki_dir = repo_root / "wiki"

    print(f"Repository root: {repo_root}")
    print(f"Wiki directory: {wiki_dir}")
    print(f"Config path: {config_path}")
    print()

    # Load configuration
    if not config_path.exists():
        print(f"Error: Config file not found: {config_path}")
        return 1

    config = load_config(str(config_path))
    pages = config.get("pages", [])
    link_mappings = config.get("link_mappings", {})
    sidebar_config = config.get("sidebar", [])

    # Ensure wiki directory exists
    if not wiki_dir.exists():
        print(f"Error: Wiki directory not found: {wiki_dir}")
        print("Make sure the wiki repo is cloned to the 'wiki' directory")
        return 1

    # Process each page
    print("Syncing documentation pages...")
    success_count = 0
    for page_config in pages:
        source = page_config.get("source", "")
        wiki_page = page_config.get("wiki_page", "")
        title = page_config.get("title")

        if not source or not wiki_page:
            print(f"  Skipping invalid config: {page_config}")
            continue

        source_path = repo_root / source
        wiki_path = wiki_dir / f"{wiki_page}.md"

        print(f"  {source} -> {wiki_page}.md")
        if process_file(str(source_path), str(wiki_path), link_mappings, title):
            success_count += 1

    print(f"\nProcessed {success_count}/{len(pages)} pages")

    # Generate sidebar
    if sidebar_config:
        print("\nGenerating sidebar...")
        generate_sidebar(sidebar_config, str(wiki_dir))

    # Generate footer
    print("Generating footer...")
    generate_footer(str(wiki_dir))

    print("\nSync complete!")
    return 0


if __name__ == "__main__":
    exit(main())
