"""Private, typed FFmpeg renderer. The caller uploads owned inputs; no URL fetching or shell."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(os.environ.get("RENDER_DATA", "/data/jobs")).resolve()
TOKEN = os.environ.get("RENDER_TOKEN", "")
SLOTS = threading.BoundedSemaphore(2)
LOCK = threading.RLock()
IDENTIFIER = re.compile(r"^[a-zA-Z0-9:_-]{1,160}$")
MAX_FILE = 50 * 1024 * 1024


def job_dir(value):
    if not IDENTIFIER.fullmatch(value):
        raise ValueError("invalid_identifier")
    path = (ROOT / value).resolve()
    path.relative_to(ROOT)
    return path


def cleanup():
    now = time.time()
    with LOCK:
        for file in ROOT.glob("*/job.json"):
            try:
                job = json.loads(file.read_text("utf-8"))
                if now - job["createdAt"] > 86400 and job["status"] != "running":
                    directory = job_dir(job["id"])
                    shutil.rmtree(directory)
            except (ValueError, KeyError, OSError):
                continue


def read_job(value):
    return json.loads((job_dir(value) / "job.json").read_text("utf-8"))


def save_job(value, job):
    path = job_dir(value)
    path.mkdir(parents=True, exist_ok=True)
    temporary = path / "job.tmp"
    temporary.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path / "job.json")


def probe(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                            capture_output=True, check=True, timeout=20, shell=False)
    return json.loads(result.stdout)


def validate(spec):
    if not isinstance(spec, dict) or set(spec) != {"id", "title", "clips", "width", "height", "captions", "maxCredits"}:
        raise ValueError("invalid_contract")
    job_dir(spec["id"])
    if not isinstance(spec["clips"], list) or not 1 <= len(spec["clips"]) <= 10:
        raise ValueError("invalid_clips")
    for key in ("width", "height"):
        if type(spec[key]) is not int or not 256 <= spec[key] <= 1920 or spec[key] % 2:
            raise ValueError("invalid_resolution")
    if spec["width"] * spec["height"] > 2073600:
        raise ValueError("invalid_resolution")
    duration = 0
    for clip in spec["clips"]:
        if set(clip) != {"fileId", "version", "sha256", "trimStart", "duration"} or not IDENTIFIER.fullmatch(clip["fileId"]):
            raise ValueError("invalid_clip")
        if not re.fullmatch(r"[a-f0-9]{64}", clip["sha256"]):
            raise ValueError("invalid_digest")
        if type(clip["duration"]) not in (int, float) or not 0.1 <= clip["duration"] <= 120:
            raise ValueError("invalid_duration")
        if type(clip["trimStart"]) not in (int, float) or not 0 <= clip["trimStart"] <= 3600:
            raise ValueError("invalid_trim")
        duration += clip["duration"]
    if duration > 180 or not isinstance(spec["captions"], list) or len(spec["captions"]) > 60:
        raise ValueError("invalid_duration")
    for caption in spec["captions"]:
        if set(caption) != {"text", "start", "end"} or not isinstance(caption["text"], str) or not 1 <= len(caption["text"]) <= 300:
            raise ValueError("invalid_caption")
        if not 0 <= caption["start"] < caption["end"] <= duration:
            raise ValueError("invalid_caption_time")
    return spec


def timestamp(seconds):
    millis = round(seconds * 1000)
    return f"{millis // 3600000:02}:{millis // 60000 % 60:02}:{millis // 1000 % 60:02},{millis % 1000:03}"


def render(value):
    started = time.monotonic()
    with SLOTS:
        try:
            with LOCK:
                job = read_job(value)
                if job["status"] != "running":
                    return
                spec = job["spec"]
            folder = job_dir(value)
            clips = []
            for index, clip in enumerate(spec["clips"]):
                source = folder / ("input-" + clip["fileId"])
                if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != clip["sha256"]:
                    raise ValueError("input_changed")
                info = probe(source)
                videos = [s for s in info["streams"] if s["codec_type"] == "video"]
                if not videos or videos[0].get("width", 0) * videos[0].get("height", 0) > 100000000:
                    raise ValueError("invalid_input")
                image = info.get("format", {}).get("format_name", "") in ("png_pipe", "jpeg_pipe", "webp_pipe", "image2")
                audio = any(s["codec_type"] == "audio" for s in info["streams"])
                target = folder / f"clip-{index}.mp4"
                command = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y"]
                if image:
                    command += ["-loop", "1"]
                command += ["-ss", str(clip["trimStart"]), "-i", str(source)]
                if not audio:
                    command += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
                width, height = spec["width"], spec["height"]
                command += ["-t", str(clip["duration"]), "-map", "0:v:0", "-map", "0:a:0" if audio else "1:a:0",
                            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", str(target)]
                subprocess.run(command, cwd=folder, check=True, capture_output=True, timeout=180, shell=False)
                clips.append(target)
            (folder / "concat.txt").write_text("\n".join(f"file '{clip.name}'" for clip in clips), encoding="utf-8")
            command = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", "concat.txt"]
            if spec["captions"]:
                text = []
                for index, caption in enumerate(spec["captions"]):
                    clean = caption["text"].replace("\r", " ").replace("\n", " ").replace("{", "(").replace("}", ")").replace("<", "‹").replace(">", "›")
                    text.append(f"{index + 1}\n{timestamp(caption['start'])} --> {timestamp(caption['end'])}\n{clean}\n")
                (folder / "captions.srt").write_text("\n".join(text), encoding="utf-8")
                command += ["-vf", "subtitles=captions.srt", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "copy"]
            else:
                command += ["-c", "copy"]
            command += ["-movflags", "+faststart", "output.mp4"]
            subprocess.run(command, cwd=folder, check=True, capture_output=True, timeout=180, shell=False)
            output = folder / "output.mp4"
            if output.stat().st_size > MAX_FILE:
                raise ValueError("output_too_large")
            metadata = probe(output)
            with LOCK:
                job = read_job(value)
                job.update(status="completed", processingMs=round((time.monotonic()-started)*1000),
                           outputSha256=hashlib.sha256(output.read_bytes()).hexdigest(), metadata=metadata)
                save_job(value, job)
        except Exception:
            with LOCK:
                job = read_job(value)
                job.update(status="failed", processingMs=round((time.monotonic()-started)*1000), error="render_failed")
                save_job(value, job)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # No access tokens, uploaded names, request bodies or provider diagnostics in logs.

    def reply(self, status, value):
        payload = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def authenticated(self):
        return bool(TOKEN) and hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + TOKEN)

    def handle_request(self):
        if not self.authenticated():
            return self.reply(401, {"error": "unauthorized"})
        cleanup()
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts == ["health"] and self.command == "GET":
            return self.reply(200, {"ready": bool(shutil.which("ffmpeg") and shutil.which("ffprobe")), "contract": "braand-render-v1"})
        if parts[:2] != ["v1", "jobs"]:
            return self.reply(404, {"error": "not_found"})
        if len(parts) == 2 and self.command == "POST":
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 65536:
                return self.reply(413, {"error": "request_too_large"})
            spec = validate(json.loads(self.rfile.read(size)))
            with LOCK:
                folder = job_dir(spec["id"])
                if folder.exists():
                    existing = read_job(spec["id"])
                    if existing["spec"] != spec:
                        return self.reply(409, {"error": "job_changed"})
                else:
                    if sum(1 for _ in ROOT.glob("*/job.json")) >= 100:
                        return self.reply(503, {"error": "capacity_reached"})
                    save_job(spec["id"], {"id": spec["id"], "status": "draft", "spec": spec, "createdAt": time.time()})
            return self.reply(201, {"id": spec["id"]})
        if len(parts) < 3:
            return self.reply(404, {"error": "not_found"})
        value = parts[2]
        folder = job_dir(value)
        job = read_job(value)
        if time.time() - job["createdAt"] > 86400:
            return self.reply(410, {"error": "expired"})
        if len(parts) == 3 and self.command == "GET":
            return self.reply(200, {key: job[key] for key in ("id", "status", "processingMs", "outputSha256", "metadata") if key in job})
        if len(parts) == 5 and parts[3] == "inputs" and self.command == "PUT":
            name = parts[4]
            clip = next((item for item in job["spec"]["clips"] if item["fileId"] == name), None)
            size = int(self.headers.get("Content-Length", "0"))
            if job["status"] != "draft" or not clip or not 0 < size <= MAX_FILE:
                return self.reply(409, {"error": "invalid_input"})
            if sum(item.stat().st_size for item in folder.glob("input-*")) + size > 150*1024*1024:
                return self.reply(413, {"error": "quota"})
            target = folder / ("input-" + name)
            temporary = folder / ("upload-" + name)
            sha = hashlib.sha256()
            remaining = size
            with temporary.open("wb") as stream:
                while remaining:
                    chunk = self.rfile.read(min(1024*1024, remaining))
                    if not chunk:
                        raise ValueError("incomplete_upload")
                    sha.update(chunk)
                    stream.write(chunk)
                    remaining -= len(chunk)
            if sha.hexdigest() != clip["sha256"]:
                temporary.unlink(missing_ok=True)
                return self.reply(409, {"error": "digest_mismatch"})
            temporary.replace(target)
            return self.reply(200, {"stored": True})
        if len(parts) == 4 and parts[3] == "run" and self.command == "POST":
            with LOCK:
                job = read_job(value)
                if job["status"] == "draft":
                    if any(not (folder / ("input-" + clip["fileId"])).is_file() for clip in job["spec"]["clips"]):
                        return self.reply(409, {"error": "missing_input"})
                    job["status"] = "running"
                    save_job(value, job)
                    threading.Thread(target=render, args=(value,), daemon=True).start()
            return self.reply(202, {"id": value, "status": job["status"]})
        if len(parts) == 4 and parts[3] == "output" and self.command == "GET" and job["status"] == "completed":
            target = folder / "output.mp4"
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(target.stat().st_size))
            self.end_headers()
            with target.open("rb") as stream:
                shutil.copyfileobj(stream, self.wfile, 1024*1024)
            return
        self.reply(404, {"error": "not_found"})

    def safe(self):
        try:
            self.handle_request()
        except FileNotFoundError:
            self.reply(404, {"error": "not_found"})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            self.reply(400, {"error": "invalid_request"})

    do_GET = safe
    do_POST = safe
    do_PUT = safe


if __name__ == "__main__":
    if len(TOKEN) < 32:
        raise SystemExit("RENDER_TOKEN must contain at least 32 characters")
    ROOT.mkdir(parents=True, exist_ok=True)
    # Persisted running jobs are uncertain after a process restart; never replay FFmpeg automatically.
    for file in ROOT.glob("*/job.json"):
        with LOCK:
            job = json.loads(file.read_text("utf-8"))
            if job["status"] == "running":
                job["status"] = "failed"
                job["error"] = "interrupted"
                save_job(job["id"], job)
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
