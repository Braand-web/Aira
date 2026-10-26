"""Import the reviewed video archive as inert agent methods, never executable code."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DIGEST = "43e8544a2b894204e715dc75ff399e009bc627fa39c31fb0041324b7e9d18e7a"
ALLOWED = {"SKILL.md", "assets/storyboard-template.md", "assets/timeline.example.json", "assets/titles.example.json"}
ALLOWED.update("references/" + name + ".md" for name in [
    "remotion", "color", "editing-craft", "delivery-specs", "motion-design",
    "anime-production", "troubleshooting", "ffmpeg-cookbook", "timeline-schema", "audio"])


def main(archive):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != DIGEST:
        raise ValueError("Archive differs from the reviewed input")
    target = ROOT / "skills/user/video-motion-studio"
    manifest = {"source": {"repository": "User-provided video-motion-studio.skill", "commit": DIGEST},
                "license": "User-provided; no redistribution license supplied", "files": [], "excluded": []}
    records = {}
    with zipfile.ZipFile(archive) as bundle:
        if len(bundle.infolist()) > 50 or sum(i.file_size for i in bundle.infolist()) > 1024 * 1024:
            raise ValueError("Unreviewed archive size")
        for entry in bundle.infolist():
            name = PurePosixPath(entry.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in entry.filename or stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError("Unsafe archive entry")
            if entry.is_dir():
                continue
            if name.parts[0] != "video-motion-studio" or entry.file_size > 64000:
                raise ValueError("Unreviewed archive entry")
            relative = PurePosixPath(*name.parts[1:]).as_posix()
            if relative in records:
                raise ValueError("Duplicate archive entry")
            data = bundle.read(entry)
            records[relative] = {"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            if relative in ALLOWED:
                data.decode("utf-8", errors="strict")
                if relative.endswith(".json"):
                    json.loads(data)
                output = target.joinpath(*PurePosixPath(relative).parts).resolve()
                output.relative_to(target.resolve())
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(data)
                manifest["files"].append(records[relative])
            else:
                manifest["excluded"].append({**records[relative], "reason": "not_bound_to_agent_runtime"})
    if set(ALLOWED) - records.keys():
        raise ValueError("Missing reviewed resources")
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(manifest['files'])} inert resources; {len(manifest['excluded'])} unbound code/install entries excluded.")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
