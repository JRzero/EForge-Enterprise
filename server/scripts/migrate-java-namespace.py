#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
OLD_NAMESPACE = "com.ruoyi"
NEW_NAMESPACE = "io.eforge.enterprise"

TEXT_SUFFIXES = {
    ".java",
    ".xml",
    ".yml",
    ".yaml",
    ".properties",
    ".json",
    ".md",
    ".txt",
    ".sql",
    ".vm",
    ".html",
    ".js",
    ".ts",
    ".sh",
    ".bat",
}

SKIP_PARTS = {"target", ".git", ".idea", ".vscode"}

updated_text_files = 0
replacement_count = 0
moved_java_files = 0

for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    if any(part in SKIP_PARTS for part in path.parts):
        continue
    if path.suffix.lower() not in TEXT_SUFFIXES and path.name != "pom.xml":
        continue

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue

    count = content.count(OLD_NAMESPACE)
    if count == 0:
        continue

    path.write_text(
        content.replace(OLD_NAMESPACE, NEW_NAMESPACE),
        encoding="utf-8",
    )
    updated_text_files += 1
    replacement_count += count

legacy_roots = sorted(
    path
    for path in ROOT.glob("*/src/*/java/com/ruoyi")
    if path.is_dir()
)

for old_root in legacy_roots:
    java_root = old_root.parent.parent
    new_root = java_root / "io" / "eforge" / "enterprise"

    source_files = sorted(path for path in old_root.rglob("*") if path.is_file())
    for source in source_files:
        relative = source.relative_to(old_root)
        destination = new_root / relative

        if destination.exists():
            print(
                f"Namespace migration collision: {source} -> {destination}",
                file=sys.stderr,
            )
            raise SystemExit(2)

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(destination))
        moved_java_files += 1

    directories = sorted(
        (path for path in old_root.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    )
    for directory in directories:
        try:
            directory.rmdir()
        except OSError:
            pass

    current = old_root
    while current != java_root:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent

remaining_content = []
remaining_paths = []

for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    if any(part in SKIP_PARTS for part in path.parts):
        continue

    if "/java/com/ruoyi/" in path.as_posix():
        remaining_paths.append(path)

    try:
        if OLD_NAMESPACE in path.read_text(encoding="utf-8"):
            remaining_content.append(path)
    except (UnicodeDecodeError, OSError):
        pass

print(f"Updated text files: {updated_text_files}")
print(f"Namespace replacements: {replacement_count}")
print(f"Moved Java files: {moved_java_files}")

if remaining_paths or remaining_content:
    if remaining_paths:
        print("Legacy Java paths remain:", file=sys.stderr)
        for path in remaining_paths:
            print(f"  {path}", file=sys.stderr)
    if remaining_content:
        print("Legacy namespace content remains:", file=sys.stderr)
        for path in remaining_content:
            print(f"  {path}", file=sys.stderr)
    raise SystemExit(3)

print("Namespace migration complete: no com.ruoyi references remain under server/.")
