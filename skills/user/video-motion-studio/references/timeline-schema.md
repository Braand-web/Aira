# Timeline JSON schema (build_timeline.py)

Read this when writing or editing a `timeline.json`. Generate a skeleton any time with
`python3 scripts/build_timeline.py --schema`. Relative paths resolve against the JSON file's folder.

Contents: output · defaults · clips · transitions · speed/ramps · zoom · titles · overlays ·
subtitles · audio/music · grade · loudnorm · preview/proxy workflow · gotchas

## Top level
```json
{
  "output":   { ... },
  "defaults": { ... },
  "clips":    [ ... ],
  "grade":    "cinematic",
  "vf":       "optional raw ffmpeg filters applied to the whole picture",
  "titles":   [ ... ],
  "overlays": [ ... ],
  "subtitles": "titles.ass",
  "audio":    { "music": { ... } },
  "fade_in": 0.4, "fade_out": 0.8,
  "loudnorm": { "lufs": -14, "tp": -1.5 }
}
```
Order of operations on the picture: per-clip chain → transitions → global grade/vf → overlays → titles
(drawtext) → subtitles (ass/srt) → global fades → CFR `fps` + `yuv420p`.

## output
| key | meaning |
|---|---|
| `path` | output file (default `out.mp4`) |
| `preset` | (CLI `--preset NAME` overrides it for one run) `720p30` `1080p24` `1080p30` `1080p60` `4k30` `vertical` (1080×1920) `square` `cinema` (2.39:1) |
| `width` `height` `fps` | override the preset (must be even). `fps` may be `"30000/1001"` |
| `codec` | `h264` (default) `h265` `prores` (.mov) `vp9` (.webm) `av1` (.mkv) |
| `crf` | h264/h265 quality: 16 high, **18 default**, 23 small. vp9 ≈ 30, av1 ≈ 32 |
| `preset_speed` | x264/x265 preset: `ultrafast`…`slow`. Default `medium` |
| `audio_bitrate` | default `192k` |

## defaults
`fit` (`cover` | `contain` | `stretch` | `blurpad`), `transition`, `grade`, `image_duration` (seconds for stills, default 3).

## clips
Each clip is exactly one of `src` (video), `image`, or `color`.

```json
{ "src": "a.mp4", "in": 2.0, "out": 6.0 }           // trim by in/out (source seconds)
{ "src": "a.mp4", "in": 2.0, "duration": 4.0 }      // OR by timeline duration (speed-aware)
{ "image": "photo.jpg", "duration": 3 }
{ "color": "black", "duration": 1.5 }               // any ffmpeg color name or 0xRRGGBB
```
Optional per clip:

| key | meaning |
|---|---|
| `speed` | 0.25 = 4× slow-mo, 2 = double. Audio is pitch-preserved via `atempo` |
| `ramp` | speed ramp, `[[source_t, speed], ...]` (see below). Mutes clip audio |
| `interp` | `"blend"` or `"mci"`: smooth slow-motion with `minterpolate` (mci is slow, may artifact) |
| `fit` | `cover` crops to fill · `contain` letterboxes · `blurpad` = contain over a blurred copy of itself (best for vertical-in-landscape) · `stretch` |
| `audio` | `true` (default) / `false` (mute) / number (volume multiplier). Needed `false` for music-led edits |
| `zoom` | Ken Burns / punch-in (see below) |
| `grade` | per-clip grade (same values as global) |
| `vf` | raw ffmpeg filter string appended to this clip's chain |
| `fade_in` `fade_out` | seconds, picture + sound |
| `transition` | transition **into** this clip from the previous one |

## transitions
`"transition": {"type": "wipeleft", "duration": 0.4}` or shorthand `"fade"` / `"cut"`.
`cut` = hard cut (`concat`), anything else = `xfade` + `acrossfade`.
Types: fade fadeblack fadewhite fadegrays dissolve distance pixelize radial · wipeleft wiperight wipeup wipedown
wipetl wipetr wipebl wipebr · slideleft slideright slideup slidedown · smoothleft/right/up/down ·
circlecrop rectcrop circleopen circleclose vertopen vertclose horzopen horzclose · diagtl diagtr diagbl diagbr ·
hlslice hrslice vuslice vdslice · squeezeh squeezev zoomin · hlwind hrwind vuwind vdwind ·
coverleft/right/up/down revealleft/right/up/down · hblur.
A transition **overlaps** the two clips, so total length = Σ durations − Σ transition durations. Durations are
clamped to half the shorter neighbouring clip. Transitions shorter than 1 frame become cuts.

Taste: use `cut` for 80%+ of joins. Dissolves for time passing, `fadeblack` for chapter breaks, wipes/slides only
when the motion matches the content direction. Transition length 0.3–0.6 s.

## speed ramps
`"ramp": [[0,1.0],[1.0,1.0],[1.5,0.25],[2.2,1.0]]` → plays normally to source t=1.0 s, eases down to 25% speed
by t=1.5 s, then eases back to 100% by t=2.2 s. Speed is linearly interpolated between keys. Give `duration` as the
**source span** to consume (`src_span` also accepted); the resulting timeline length is computed and may differ.
Add `"interp":"blend"` for smoother slow sections. The classic anime/AMV "hit": hold 1.0 → ramp to 0.2 on the strike
→ snap back to 1.0 (+ `anime_fx.py --preset hit`).

## zoom (Ken Burns, punch-ins, pans)
`"zoom": {"from": 1.0, "to": 1.15, "ease": "out", "x": [0.4, 0.6], "y": 0.5}`
`x`,`y` = focus point 0–1 (number or `[start,end]` to pan). `ease`: `out` (default for push-ins to feel natural, use
`inout` for drift), `in`, `inout`, `linear`. Subtle: 1.0→1.08. Dramatic: 1.0→1.3. Works on stills and video (video is
re-rendered through zoompan: fine for short clips).

## titles (drawtext — simple, fast)
```json
{ "text": "MY FILM", "start": 0.5, "end": 3.0, "style": "center", "size": 96,
  "color": "white", "slide": 40, "fade_in": 0.35, "fade_out": 0.35,
  "box": false, "border": 0, "fontfile": "/path/font.ttf", "x": "(w-text_w)/2", "y": "h*0.4" }
```
`style`: `center` `lower_third` (auto box) `top` `caption`. `size` is in px **at 1080p** (auto-scaled for other
heights). `slide` slides up from N px below with ease-out. Multi-line text: use `\n`. For anything fancier
(typewriter, word-pop, glitch, karaoke) use `scripts/ass_titles.py` and the `subtitles` field.

## overlays (logos, stickers, FX plates)
```json
{ "src": "logo.png", "x": "W-w-30", "y": "30", "width": 120, "opacity": 0.85,
  "start": 0, "end": 5, "fade_in": 0.5, "fade_out": 0.5 }
{ "src": "speedlines.mp4", "blend": "screen", "start": 2.0, "end": 3.0 }   // black-background plate → blend mode
```
`x`,`y` are ffmpeg expressions (`W,H` = main video, `w,h` = overlay). `blend`: `screen` (light/glow/lines on black),
`multiply` (shadows/paper), `overlay`, `lighten`, `addition`. Video plates loop; use `start/end` for placement —
remember the plate plays from ITS frame 0 at timeline 0 (trim/offset the plate file itself to time it).

## subtitles
`"subtitles": "titles.ass"` (animated, from ass_titles.py) or `"captions.srt"`; a list burns several.
For SRT style override: `"subtitle_style": "FontName=Poppins,FontSize=26,Outline=2,Shadow=1,MarginV=60"`.

## audio.music
```json
"audio": { "music": { "src": "song.mp3", "volume": 0.35, "start": 12.0, "loop": true,
                      "duck": true, "fade_in": 0.5, "fade_out": 2.0 } }
```
`duck: true` lowers the music whenever the clips' own audio (speech) is present (sidechain compression).
`start` = skip into the track. Music is trimmed to video length. For music-led edits set clips `audio:false`,
`duck:false`, `volume:1.0`.

## loudnorm
`"loudnorm": {"lufs": -14, "tp": -1.5}` → two-pass measure on the final mix (no video decode), applied inside the
single final encode, then a safety limiter. Skipped in `--preview`. Verify with `qa_check.py`; very peaky mixes may land
1–2 LU under target because the true-peak ceiling wins — that is correct behaviour.

## preview / proxy workflow
1. `--preview` renders half-res, ultrafast, CRF 30 → seconds instead of minutes. Judge timing here.
2. Contact-sheet the preview; fix; repeat.
3. Final render without `--preview`. If sources are heavy (4K/HEVC), run `make_proxy.sh` first, point a copy of the
   timeline at the proxies, then switch paths back for the final.

## gotchas
* Clip `duration` longer than the footage is clamped (warning printed) → the edit ends shorter than planned.
* Mixed fps / resolutions / rotated phone video are normalised per clip (fps + scale + setsar); you don't pre-convert.
* `out` and `duration` together: `duration` wins.
* Very long timelines (100+ clips): fine, graph goes to a script file; but render time scales with total frames, so
  prefer `--preview` while editing.
* `--dry-run --print-graph` shows the generated filtergraph for debugging; `--keep-work` keeps the temp folder.
