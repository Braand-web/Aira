# Troubleshooting — symptoms → causes → fixes

Method: read the **last** error line, not the first. Reproduce on the smallest input. Use `--dry-run --print-graph` (build_timeline) or
`anime_fx.py apply … --print` to see the generated filter chain. Isolate by removing filters one at a time.

Contents: ffmpeg errors · picture problems · audio problems · timing/sync · performance · environment

## ffmpeg errors
| message | cause | fix |
|---|---|---|
| `No such filter: 'X'` | filter missing in this build **or** a comma/colon split an expression | run `check_env.sh`; single-quote expressions that contain commas: `enable='between(t,1,3)'` |
| `Error applying option 'X' to filter 'Y': Option not found` | option doesn't exist in this ffmpeg version | `ffmpeg -h filter=Y` and use the listed options (e.g. `bilateral` has no `steps` in 6.1) |
| `Invalid argument` on a filter | wrong value type/range, or unescaped `:` | simplify; for paths use `esc_filter_path` logic: `\\:` for colons, forward slashes |
| `Input link in1:v0 parameters (size 1920x1080, SAR 1:1) do not match … in0` (xfade/overlay/hstack/concat) | different size/SAR/fps/pixfmt | normalise each stream: `fps,scale,setsar=1,format=yuv420p` (build_timeline does) |
| `First input link main timebase (1/30) do not match … (1/24)` | xfade timebases differ | add `settb=AVTB` (or `fps=` at the end of both chains) |
| `Too many packets buffered for output stream` | inputs with very different durations/streams starved | add `-max_muxing_queue_size 4096`; ensure every branch is mapped |
| `Output pad "default" … not connected` / `Filter … has an unconnected output` | a labelled/unlabelled pad isn't consumed | map it (`-map "[x]"`) or terminate (`anullsink` / `nullsink`) |
| `Stream map '…' matches no streams` | wrong label or input has no audio | probe the input; add `anullsrc` for silent clips |
| `Unrecognized option` for `-/filter_complex` | ffmpeg < 7 | use `-filter_complex_script file` (build_timeline picks automatically) |
| `Application provided invalid, non monotonically increasing dts` | VFR/trimmed input | normalise to CFR first; add `-fflags +genpts` |
| `moov atom not found` | truncated/unfinished MP4 | re-export source; `untrunc` if recoverable |
| `Could not find tag for codec … in stream, codec not currently supported in container` | e.g. PCM/AV1 in MP4 | use `.mov`/`.mkv` or change codec |
| `Conversion failed!` generic | something earlier in the log | scroll up to first `[Parsed_…]` or `[libx264]` error |
| `Filter … does not support timeline` (enable) | filter can't use `enable=` | use overlay-with-enable trick (see `anime_fx.py shake`) or split into time segments |

## Picture problems
| symptom | cause / fix |
|---|---|
| Green/pink/odd colours | wrong pix_fmt or range; force `-pix_fmt yuv420p`; for RGB sources `scale=out_color_matrix=bt709` |
| Washed-out / too contrasty | tv vs pc range mismatch; see `color.md` colour-space hygiene |
| Black frame mid-video | transition offset wrong, clip shorter than requested, or xfade on mismatched lengths; run `qa_check.py` (lists time ranges) |
| Frozen tail | clip ran out of footage and was clamped/held; shorten the timeline duration or pick a longer source |
| Stretched or squashed picture | SAR/rotation; add `setsar=1`, check `probe_media.py` rotation; never `scale=W:H` without `force_original_aspect_ratio` unless intended |
| Sideways phone video | rotation metadata with `-noautorotate`; else apply `transpose=1/2` |
| Blurry upscales | `flags=lanczos`; for anime use a dedicated upscaler (Real-ESRGAN) |
| Banding in gradients | 8-bit gradient: add `noise=alls=3:allf=t` or `deband`, raise bitrate (CRF 16), `-tune animation` for flat art |
| Jittery Ken Burns/zoompan | upscale ×2 before `zoompan` (build_timeline does) and use floating-point easing |
| Text invisible / wrong font | missing font file: `fc-list`, pass `fontfile=` (drawtext) or `fontsdir=` (ass/subtitles); ASS font name must match family |
| Text clipped at edges | exceeds frame: reduce size, wrap lines, check `w`/`text_w` expressions; keep 5 % margins |
| Subtitles don't show | path escaping (Windows `C\:/…`), file encoding (UTF-8), or `ass` filter given an SRT |
| GIF looks dithered/ugly | use palettegen/paletteuse (cookbook) or switch to WebP/MP4 |
| Overlay PNG has a black box | PNG lacks alpha or overlay chain lost format: `format=rgba` on the overlay input |

## Audio problems
| symptom | cause / fix |
|---|---|
| No audio in output | source lacked audio and nothing generated it; `anullsrc` for silence; ensure `-map` includes `[aout]` |
| Audio too quiet/loud | loudness pass: `loudnorm.py` / timeline `loudnorm`; check `qa_check.py` |
| Clipping/distortion | reduce gains, add `alimiter`, lower music volume; `-b:a` ≥ 192k |
| Music masks speech | `duck:true`, lower music volume to 0.2–0.3, EQ cut 1–4 kHz on music |
| Clicks at cuts | micro fades (10 ms) or crossfades; avoid cutting inside waveforms with `afade` |
| Drift (audio late/early more over time) | VFR video or sample-rate mismatch: normalise CFR + `aresample=48000:async=1` |
| Audio longer than video | `-shortest` or explicit `-t`; timeline sets `-t` automatically |
| Mono on one speaker | `aformat=channel_layouts=stereo` or `pan=stereo|c0=c0|c1=c0` |

## Timing / sync
* Total length ≠ plan: transitions overlap (length = Σ − Σtransitions); clips clamped by available footage (warnings printed); speed changes alter durations.
* Beat cuts feel late: shift cut points 1–2 frames earlier; check grid with `click_track.py --report`.
* A/V offset after trimming with `-c copy`: re-encode or use `-avoid_negative_ts make_zero`.
* Slow-motion judder: add `interp:"blend"` (or shoot/generate at higher fps).

## Performance
* Iterate with `--preview` (¼ pixels, ultrafast). Final render once.
* Proxies for 4K/HEVC/ProRes sources (`make_proxy.sh`); render final from originals.
* `-preset veryfast` for drafts; `-threads 0` default is fine; GPU encoders (nvenc/videotoolbox/vaapi) when hardware exists.
* Avoid `minterpolate mci`, heavy `gblur`, `vidstab`, `reverse` on long clips — cut to the needed range first.
* Long jobs: run in background and poll the log; don't hold a request open. Report progress by milestones, not per frame.

## Environment
* `ffmpeg: command not found` → install (apt/brew/winget) or use a static build; `check_env.sh` lists what's available.
* `pip install` blocked → scripts only need numpy (optional) and Pillow (parallax/contact labels/speedlines); beat/QA/timeline work without them (labels degrade).
* Network allowlists often block `curl`/downloads from arbitrary sites (and Remotion's browser download); ask the user to attach assets instead of retrying other routes.
* Windows: use `py -3`, forward slashes in filter paths, escape `:` as `\:`; shell scripts (`.sh`) need WSL/Git Bash — Python scripts work natively.
* Fonts: if the requested font isn't installed, say so, use the closest available, and mention how to bundle (`fontsdir`, `fontfile`).
