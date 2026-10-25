"""Import a reviewed user archive as inert private data; never run archive scripts."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
archive = Path(sys.argv[1]).resolve()
# The exact digest is a reviewed input, not an attribution or redistribution license.
actual = hashlib.sha256(archive.read_bytes()).hexdigest()
if actual != "c28fd89edc6fcfbafccf3e3cb1dac6c471f0eca80bd982d2d61983e111700bd9":
    raise ValueError("The user archive differs from the reviewed input")
target = root / "skills" / "user" / "social-media-manager"
manifest = {"source": {"repository": "User-provided social-media-manager.skill", "commit": actual},
            "license": "User-provided; no redistribution license supplied", "files": [], "excluded": []}
with zipfile.ZipFile(archive) as bundle:
    for entry in bundle.infolist():
        name = PurePosixPath(entry.filename)
        if name.is_absolute() or ".." in name.parts or "\\" in entry.filename:
            raise ValueError("Unsafe archive path")
        if entry.is_dir():
            continue
        if entry.file_size > 64000:
            raise ValueError("Unreviewed oversized entry")
        data = bundle.read(entry)
        parts = name.parts
        if parts[0] == "social-media-manager":
            parts = parts[1:]
        relative = PurePosixPath(*parts).as_posix()
        record = {"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        if relative == "SKILL.md" or relative.startswith("references/") and relative.endswith(".md") or relative.startswith("assets/") and relative.endswith((".md", ".json")):
            output = target.joinpath(*PurePosixPath(relative).parts).resolve()
            output.relative_to(target.resolve())
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(data)
            manifest["files"].append(record)
        else:
            manifest["excluded"].append(record)
target.mkdir(parents=True, exist_ok=True)
(target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(manifest['files'])} inert resources; {len(manifest['excluded'])} executable/unsupported entries excluded.")
