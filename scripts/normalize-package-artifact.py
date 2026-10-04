"""Canonicalize tar ordering/metadata and gzip encoding without changing payloads."""
import gzip
import io
from pathlib import Path
import sys
import tarfile


def normalize(path: Path) -> None:
    contents = io.BytesIO()
    with tarfile.open(path, "r:gz") as original:
        with tarfile.open(fileobj=contents, mode="w", format=tarfile.USTAR_FORMAT) as output:
            for member in sorted(original.getmembers(), key=lambda item: item.name):
                if not member.isfile() or not member.name.startswith("package/"):
                    raise ValueError(f"Unexpected package member: {member.name}")
                entry = tarfile.TarInfo(member.name)
                entry.size = member.size
                entry.mode = member.mode
                entry.mtime = 499162500  # npm's fixed package timestamp
                output.addfile(entry, original.extractfile(member))
    encoded = io.BytesIO()
    with gzip.GzipFile(fileobj=encoded, mode="wb", filename="", mtime=0, compresslevel=9) as output:
        output.write(contents.getvalue())
    path.write_bytes(encoded.getvalue())


if __name__ == "__main__":
    for argument in sys.argv[1:]:
        normalize(Path(argument))
