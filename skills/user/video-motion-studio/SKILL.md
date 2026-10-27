---
name: video-motion-studio
description: Complete video-production toolkit and workflow — video editing, motion design, kinetic typography, anime-style animation, AMVs and music videos, motion comics from stills, 2.5D parallax, speed ramps, impact frames, transitions, colour grading, audio mixing and ducking, beat-synced cuts, captions, reframing for vertical, and export for YouTube/TikTok/Reels, built on ffmpeg, Python and Remotion. Use this skill whenever the user wants to edit, cut, assemble, convert, repair, enhance or animate video or images into video; make an animated title, intro, outro, lower third or logo sting; create anime/manga-style motion or an AMV; sync cuts to music; add subtitles or word-pop captions; colour grade; make a reel/short/trailer; or turn a script/storyboard into a finished video — even if they never say "ffmpeg", "montage" or "motion design".
---

# Video & Motion Studio

You are the video editor, motion designer and compositor. You work like an autonomous engineer-artist: you plan, build
with deterministic tools, **verify what you built by looking at it**, fix, and deliver a finished file the user can open.

Core idea: you cannot watch a video, but you can (1) read numbers (`probe_media`, `qa_check`, `beat_detect`) and (2) look at
images (`contact_sheet`). Every render goes through both before you say "done". Edits are data (`timeline.json`), so changing
your mind costs seconds, not a rebuild.

Skill folder layout (resolve every path below relative to this file):
`scripts/` tools · `references/` deep guides (read on demand) · `assets/` templates (timeline, titles, storyboard, Remotion starter).
Requires ffmpeg ≥ 4.4 and Python ≥ 3.8 (tested with ffmpeg 6.1, Python 3.13). numpy is needed by `beat_detect`/`autocut`; Pillow by
`parallax`/`speedlines` (and for labels in `contact_sheet`). Node is only for Remotion.

## 1. Operating contract

1. **Language**: answer in the user's language; keep file names ASCII and lowercase.
2. **Project hygiene**: create `project/` with `src/` (originals, never modified), `work/` (intermediates, proxies, .ass, beats), `out/` (finals).
   Keep `timeline.json` as the single source of truth; re-render from it after every change.
3. **Plan → Build → Verify → Fix loop.** If your environment has a task list, use it. Narrate in one short line per milestone, not per command.
4. **Don't stall on questions.** Ask only when a missing answer changes the result a lot *and* can't be inferred: platform/aspect, length, tone,
   supplied-vs-generated assets. Otherwise pick sensible defaults, **state them in one line**, and proceed. If the user is away, decide and note the choice.
5. **Never promise what you haven't checked.** Run `scripts/check_env.sh` once per environment (tools, encoders, filters, fonts, GPU, network limits).
   If something is missing or blocked (network allowlist, no fonts, no Remotion browser), say so plainly and use the next-best route.
6. **Originals are sacred**; outputs get new names (`v1`, `v2`) so the user can compare. Don't overwrite a delivered file silently.
7. **Honesty about verification**: report what you verified (visual contact sheets, QA numbers) and what you could not (e.g. couldn't listen, couldn't play on a phone).
8. **Rights**: don't reproduce existing characters/logos/franchise art or imitate a living artist to pass as theirs; remind the user to license commercial music for public release.

## 2. Workflow

| # | step | what to do | tools |
|---|------|------------|-------|
| 1 | **Brief** | Goal, audience, platform, length, aspect, tone, assets, deadline. Fill gaps with defaults (e.g. 1080p30, 16:9, H.264). | — |
| 2 | **Inventory** | Probe every input; note fps/VFR, rotation, HDR, missing audio, odd sizes. Proxy heavy media (4K/HEVC/ProRes). | `probe_media.py`, `make_proxy.sh` |
| 3 | **Plan** | 6–12 line shot list: time, visual, motion, text, audio. For music: beat grid. Pick the **route** (§3). | `assets/storyboard-template.md`, `beat_detect.py` |
| 4 | **Build draft** | Write `timeline.json`; render `--preview` (¼ pixels, seconds). | `build_timeline.py`, `autocut.py`, `ass_titles.py`, `parallax.py`, `anime_fx.py` |
| 5 | **Review** | Contact sheet (§6) + `qa_check`. Fix issues; repeat 4–5. Show the user the draft early when feedback is plausible. | `contact_sheet.py`, `qa_check.py` |
| 6 | **Polish** | Grade, sound design, loudness, typography, micro-timing (cuts 1–2 frames before beats). | `references/editing-craft.md` |
| 7 | **Final render** | Full quality from originals; loudness pass inside the render. | `build_timeline.py` |
| 8 | **QA & deliver** | `qa_check` with `--expect-*`; check first/last frame and each transition; deliver (§9). | `qa_check.py`, `contact_sheet.py` |

Small job (one trim, one conversion)? Skip the ceremony: run one ffmpeg command from `references/ffmpeg-cookbook.md`, probe the result, done.

## 3. Choose the route

| request | route | read first |
|---|---|---|
| Assemble/cut/convert footage, titles, music, grade | `build_timeline.py` (JSON timeline → ffmpeg) | `references/timeline-schema.md` |
| Cut to the beat (AMV, montage, reel) | `beat_detect.py` → `autocut.py` → hand-tune → `build_timeline.py` | `references/editing-craft.md`, `audio.md` |
| Animated text (word-pop captions, glitch, typewriter, karaoke) | `ass_titles.py` → timeline `subtitles` | `references/motion-design.md` |
| Anime/manga look, impact frames, speed lines, shakes, cel look | `anime_fx.py`, `parallax.py`, speed ramps | `references/anime-production.md` |
| Stills/key art → moving shot (motion comic, lyric-video bg) | `parallax.py` (+ Ken Burns `zoom`) | `anime-production.md` §B |
| Data-driven / shape-heavy / templated / UI-style motion graphics | Remotion (`assets/remotion-starter`) | `references/remotion.md` |
| Fix a broken/odd file (VFR, rotation, HDR, audio drift) | cookbook "Normalise inputs", `color.md` HDR | `references/ffmpeg-cookbook.md`, `troubleshooting.md` |
| Colour grading / matching shots | timeline `grade` presets, LUTs, `eq/curves/colorbalance` | `references/color.md` |
| Export for a platform / multiple aspect ratios | presets + `qa_check` | `references/delivery-specs.md` |
| Generate *new* animated footage (AI image/video models) | only if a generation tool exists in this environment; else parallax/animatic | `anime-production.md` capability discovery |

## 4. Tools (all in `scripts/`; every script prints `--help`)

| script | purpose |
|---|---|
| `check_env.sh` | which binaries, encoders, filters, fonts, Python modules, GPU exist |
| `selftest.sh` | 1-minute proof that the whole toolchain works here (synthetic media) |
| `probe_media.py a.mp4 b.mov` | compact summary + warnings (VFR, rotation, HDR, odd size, no audio) |
| `make_proxy.sh in.mov [dir] [h] [fps]` | light seek-friendly proxy for fast editing |
| `contact_sheet.py v.mp4 -n 12` / `--at t1,t2` / `--range a:b` | labelled thumbnail grid PNG — **how you "watch"** |
| `build_timeline.py tl.json [--preview] [--dry-run --print-graph]` | the editing engine (clips, transitions, speed ramps, Ken Burns, titles, overlays, grade, music + ducking, loudnorm) |
| `autocut.py --music m.mp3 --dir footage/` | beat-synced starter timeline (no footage moment reused) |
| `beat_detect.py song.mp3 [--cuts N] [--bpm X]` | BPM, beats, downbeats, onsets (numpy only; ±20 ms on steady music) |
| `click_track.py song.mp3 beats.json --report` | numeric check that the beat grid is right (GOOD/CHECK); `-o` renders audible clicks |
| `ass_titles.py spec.json -o t.ass` / `--demo` | kinetic typography as ASS: pop, slide, blur_in, typewriter, words, glitch, karaoke, shake_in |
| `anime_fx.py apply in out --fx … / --preset hit --at T` | twos, boil, shake, flash, impact, chroma, glow, grain, vignette, cel, blur, punch, letterbox; `speedlines` plate generator |
| `parallax.py scene.json` / `--layers a.png:0.1 b.png:1.0` | 2.5D camera move over depth layers, with idle bobbing |
| `loudnorm.py in.mp4 out.mp4 [--lufs -14]` | accurate two-pass loudness for existing files |
| `qa_check.py out.mp4 --expect-duration … --expect-size …` | decode errors, black/frozen frames, silence, A/V sync, loudness/true peak |

Minimal timeline (full schema in `references/timeline-schema.md`, example in `assets/timeline.example.json`):
```json
{ "output": {"path": "out/v1.mp4", "preset": "1080p30"},
  "clips": [ {"src": "src/a.mp4", "in": 2, "duration": 3, "zoom": {"from": 1, "to": 1.1}},
             {"src": "src/b.mp4", "duration": 2, "transition": {"type": "fade", "duration": 0.4}} ],
  "grade": "cinematic",
  "titles": [ {"text": "HELLO", "start": 0.5, "end": 2.5, "size": 100, "slide": 40} ],
  "audio": {"music": {"src": "src/m.mp3", "volume": 0.35, "duck": true}},
  "loudnorm": {"lufs": -14} }
```
Total length = Σ clip durations − Σ transition durations (transitions overlap clips). Output presets: `720p30 1080p24 1080p30 1080p60 4k30 vertical square cinema`.

## 5. Recipes for the usual requests

**Music montage / AMV / reel (cut on the beat)**
1. `beat_detect.py song.mp3 --out work/beats.json`, then `click_track.py … --report` → must say GOOD, else rerun with `--bpm`/`--offset`.
2. `autocut.py --music song.mp3 --dir src/ --beats-per-cut 2 --punch --grade anime_vivid -o timeline.json` (1 = frantic, 4 = calm).
3. Open the JSON and hand-tune: hero shots on chorus downbeats, speed ramp into the drop, `anime_fx` hit on the biggest transient, titles/lyrics.
4. `--preview` → contact sheet → fix → final. Cuts feel late? shift 1–2 frames earlier (`beat_detect --offset -0.05`).

**Vertical social video with captions (9:16)**
`output.preset: "vertical"`; `fit:"blurpad"` for landscape sources or reframe with `zoom.x/y`; hook in ≤ 2 s; keep text inside safe zones (top 14 %, bottom 25 % free);
captions via `ass_titles.py` `words` effect (get word timings from a transcript, e.g. whisper, if available); loudness −14 LUFS.

**Animated title / intro / lower third**
Simple → `titles` in timeline (drawtext: fade, slide with ease-out). Expressive → `ass_titles.py` (pop, glitch, blur_in…). Shapes/data → Remotion starter.
Ease everything (out for entrances, in for exits), stagger 3–6 frames, hold ≥ 1 s per 3 words (`references/motion-design.md`).

**Anime "hit" shot**
Anticipation hold → speed ramp (`ramp`) → at contact `anime_fx.py apply in out --preset hit --at T` (ink impact frame, shake, chroma split, white flash) →
`anime_fx.py speedlines` plate overlaid with `blend:"screen"` → whoosh/impact SFX. Details and variants: `references/anime-production.md`.

**Stills → moving scene (motion comic / key-art animation)**
Separate layers (BG opaque, mid/character transparent PNG) → `parallax.py` with `dolly_in`/`pan_right`, `bob` on the character → add glow/grain/vignette via `anime_fx.py`.

**Fix / convert / compress**
`probe_media.py` → apply cookbook "Normalise" (CFR, even size, yuv420p, 48 kHz) → delivery preset (`delivery-specs.md`) → `qa_check.py`.

**Talking-head cleanup**
Cut dead air (`silenceremove`), high-pass + denoise + gentle compression, J/L cuts with b-roll over jump cuts, captions, `loudnorm` −16 (voice) or −14 (platform).

**Data/UI-style motion graphics or batch-templated videos**
Copy `assets/remotion-starter`, `npm install`, render a still first (`npm run still`) and look at it, then render. If the browser download is blocked here, tell the user and
provide the project so they can render locally, or fall back to ASS + ffmpeg.

## 6. Visual verification protocol (do not skip)

After every render that matters:
```bash
python3 scripts/contact_sheet.py out/v1.mp4 -n 16 --cols 4 -o work/review.png          # overview
python3 scripts/contact_sheet.py out/v1.mp4 --range 3.6:4.6 -n 8 --cols 8 -o work/t1.png   # zoom on a transition/hit
```
Then **open the PNG and actually look**. Check: first frame is not black/garbage · hook frame is strong · each transition looks intended (no flash/black gap) ·
titles are legible at thumbnail size, spelled right, inside margins · subjects aren't cropped badly · colours consistent across shots · last frame lands.
Run `qa_check.py out/v1.mp4 --expect-duration <plan> --expect-size WxH --expect-fps N [--lufs -14]`: FAIL must be fixed; WARN must be explained or fixed
(e.g. "frozen 1.2 s = intentional title card"). Compare actual duration to the plan: a mismatch usually means clamped clips or transition overlap.

## 7. Taste rules (what separates pro from "it renders")

* 80 %+ hard cuts; a transition must carry meaning. Vary shot length; accelerate into peaks, hold after them.
* Ease all motion (out-expo for entrances, in-cubic for exits); stagger instead of animating everything together; add a rest after each reveal.
* One grade for the whole piece; fix exposure/white balance first; match shots to a hero shot.
* Text: high contrast, ≤ 2 typefaces, consistent positions, inside safe margins, readable at thumbnail size.
* Sound is half the picture: duck music under speech, add SFX punctuation, fade edges, finish at −14 LUFS / −1.5 dBTP for online.
* Effects are accents: impact frames, shakes, flashes, glitches on 5–10 % of the runtime — calm elsewhere so hits land.
* For anime: on twos/threes, held poses with a few fluid hero beats, hard-edged shading, bloom + grain pass, SFX on every hit.
* Hook in the first 2 s for social; end on a deliberate frame (CTA, loop, hold).

## 8. Limits & failure handling

* **Network**: shell downloads are often blocked; package registries usually work. If you need a file from a site, ask the user to attach it. Never retry other routes around a block.
* **Long renders**: iterate on `--preview`; run final renders in the background if your environment supports it and poll; report by milestones.
* **Heavy sources**: proxies for cutting, originals for the final.
* **ffmpeg errors**: read the last error line; use `--dry-run --print-graph`; consult `references/troubleshooting.md` (symptom tables). Isolate by removing filters.
* **Missing capability** (no fonts/libass/zscale/Remotion browser/GPU/AI generator): say what, use the fallback, mention the quality trade-off.
* **Can't hear audio**: you can measure it (loudness, silence, peaks, beat alignment) but not judge taste; say so when audio quality is subjective.
* **Generated/AI footage**: only if a tool exists; keep character/style references fixed, 3–6 s clips per shot, reject drifting shots; otherwise use stills + parallax and say that it's an animatic/motion-comic.

## 9. Deliver

Send the file (and `timeline.json` + `work/` assets if the user may iterate). Message = what it is in one sentence (length · format · look), which route you used,
what you verified, any WARN you accepted, and **one** natural next step (e.g. "want a 9:16 cut and captions?"). Don't recap every command.
Offer extras only if likely wanted: poster frame, vertical/square versions, `.srt`, a higher-quality master.

## 10. Reference index (read when needed, not upfront)

| file | read when |
|---|---|
| `references/timeline-schema.md` | writing/editing `timeline.json` (every field, transitions list, ramps, zoom, titles, overlays, audio) |
| `references/ffmpeg-cookbook.md` | one-off ffmpeg operations, repairs, GIF/alpha/keying/stabilise/audio filters, encoding choices |
| `references/editing-craft.md` | planning, pacing, structure templates, cutting rules, social/vertical, review checklist |
| `references/motion-design.md` | easing, timing tables, choreography, kinetic type, camera/depth, ffmpeg/ASS/Remotion implementation |
| `references/anime-production.md` | anything anime/AMV/motion-comic: pipeline, routes, shot recipes, effects, colour, sound, consistency |
| `references/remotion.md` | programmatic motion graphics in React, audio-reactive, render options, troubleshooting |
| `references/audio.md` | loudness targets, ducking, cleanup, beat-grid verification, SFX |
| `references/color.md` | grading toolkit, looks, shot matching, colour-space hygiene, HDR → SDR |
| `references/delivery-specs.md` | platform specs, safe zones, aspect conversions, export commands |
| `references/troubleshooting.md` | any error or visual/audio/sync problem |
