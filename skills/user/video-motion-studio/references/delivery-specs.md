# Delivery specs — formats, platforms, export presets

**Platform limits and recommendations change often.** The values below are safe, conservative defaults. If the exact
limit matters (max length, file size, new aspect support) and web search is available, check the platform's current
help page before promising. When in doubt: H.264 High + AAC in MP4, yuv420p, `+faststart`.

Contents: universal master · platform table · safe zones · aspect-ratio conversions · export commands · deliverables checklist

## Universal "plays everywhere" file
```bash
ffmpeg -i master.mov -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart final.mp4
```
* CFR (constant frame rate), even dimensions, square pixels, yuv420p, 48 kHz stereo AAC, `moov` atom at the front (`faststart`).
* Keep a high-quality master (ProRes 422 HQ or CRF 14 H.264) so you can re-export for other platforms without generation loss.

## Platform cheat-sheet (verify when it matters)
| destination | aspect / size | fps | video | audio | notes |
|---|---|---|---|---|---|
| YouTube (landscape) | 16:9; 1080p or 4K | match source (24/30/60) | H.264 (or VP9/AV1 re-encoded by YT) 8–12 Mbps @1080p30, 35–45 Mbps @4K | AAC 48 kHz, −14 LUFS | upload highest quality; YT re-encodes |
| YouTube Shorts | 9:16, 1080×1920 | 30/60 | H.264 | AAC | length limit exists (currently up to ~3 min; check) |
| Instagram Reels | 9:16, 1080×1920 | 30 | H.264, ≤ ~10 Mbps | AAC 48 kHz | respect UI safe zones; length limit changes |
| TikTok | 9:16, 1080×1920 | 30 | H.264/H.265 | AAC | similar safe zones; captions/text inside safe area |
| Instagram feed / Facebook | 4:5 (1080×1350) or 1:1 (1080×1080) or 16:9 | 30 | H.264 | AAC | 4:5 gets most screen space in feed |
| X / LinkedIn | 16:9 or 1:1 (or 9:16) | 30 | H.264 | AAC | check file-size/length caps |
| Web embed / site hero | 16:9; also provide WebM/AV1 + poster | 24–30 | H.264 MP4 + VP9/AV1 WebM | muted autoplay: omit audio or `-an` | keep < ~5–8 MB for hero loops |
| Presentation / PowerPoint | 16:9 1080p | 30 | H.264 MP4 | AAC | avoid exotic codecs; embed test |
| Broadcast / festival | per spec sheet | 23.976/25/29.97 | ProRes 422 HQ / DNxHR, 10-bit | PCM 48 kHz −23 LUFS | ask for the spec document |
| Transparent overlay | any | match project | ProRes 4444 (yuva444p10le) .mov or VP9 alpha .webm | — | pro editors accept ProRes 4444 |
| GIF / loop | ≤ 720 px wide | 12–15 | palette GIF or animated WebP | none | WebP/MP4 loops are smaller and cleaner |

## Safe zones for vertical video (1080×1920)
Keep essential text/faces inside roughly: **top 14 % free, bottom 25 % free, sides ≥ 6 %** (UI overlays: username, caption, buttons).
Put captions at ~65–72 % of the height. Verify with a mock overlay on the contact sheet if the layout is tight.

## Converting aspect ratios
* Prefer **re-framing** per shot (`zoom.x/y` focus, `fit: cover`) over blind centre crops; use `fit: blurpad` only for content that must stay fully visible.
* Re-layout text for the new aspect (don't just scale); in Remotion size from `width/height`.
* Provide each aspect as a separate export from the same timeline: change `output.preset` (`1080p30` → `vertical` → `square`).

## Export commands
```bash
# Timeline → multiple deliverables (same edit, different canvas; re-frame per shot afterwards if needed)
for P in 1080p30 vertical square; do
  python3 scripts/build_timeline.py timeline.json --preset $P -o out/final_$P.mp4
done
# Archive master
ffmpeg -i final.mp4 -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s16le master.mov
# Small preview for chat/email (≈ 3–6 MB per 10 s at 720p)
ffmpeg -i final.mp4 -vf scale=-2:720 -c:v libx264 -crf 26 -preset veryfast -c:a aac -b:a 96k preview_720p.mp4
# Poster frame
ffmpeg -ss 3 -i final.mp4 -frames:v 1 -q:v 2 poster.jpg
# Target a file size (e.g. 25 MB for 60 s incl. audio): video kbps ≈ (25*8192/60) − 128 ≈ 3290 → two-pass
ffmpeg -y -i in.mp4 -c:v libx264 -b:v 3290k -pass 1 -an -f null /dev/null && \
ffmpeg -i in.mp4 -c:v libx264 -b:v 3290k -pass 2 -c:a aac -b:a 128k out.mp4
```
`--preset` overrides `output.preset` (and drops fixed width/height). Landscape→vertical usually needs per-shot reframing (`zoom.x/y`, `fit`) and re-laid-out titles: use a copy of the timeline for the hero deliverable.

## Deliverables checklist
- [ ] Exact format asked for (container, codec, resolution, fps, aspect, length)
- [ ] `qa_check.py` with `--expect-*` flags → PASS (or WARN explained)
- [ ] Looked at the contact sheet (first frame, last frame, every transition, every title)
- [ ] File opens in a normal player (yuv420p, faststart); size reasonable for where it's going
- [ ] Optional extras the user probably wants: poster frame, vertical/square cut, captions file (.srt), project folder with timeline JSON so changes are cheap
