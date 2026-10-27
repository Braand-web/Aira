# Colour — grading, matching, colour spaces, HDR → SDR

Contents: golden rules · ffmpeg grading toolkit · looks · matching shots · LUTs · colour-space hygiene · HDR → SDR · checks

## Golden rules
1. **Fix before you stylise**: exposure → white balance → contrast → saturation → *then* the look.
2. **One grade per video** applied consistently (global `grade`), with per-clip corrections only to *match* shots.
3. Work in Rec.709 SDR for web delivery; tag the output (`-colorspace bt709 -color_primaries bt709 -color_trc bt709`).
4. Check skin tones and neutral greys first; check the contact sheet side by side; step back — subtle beats heavy.
5. Don't crush: keep detail in blacks/whites unless the look demands it. Use a waveform (`waveform` filter) to see clipping.

## ffmpeg grading toolkit
```
eq=brightness=0.03:contrast=1.08:saturation=1.15:gamma=0.98        # basic; brightness −1..1 (small steps), gamma 0.1..10
colorbalance=rs=-0.05:bs=0.06:rm=0.02:bm=-0.02:rh=0.06:bh=-0.05     # shadows/mids/highlights R/G/B shifts (teal-orange)
colortemperature=temperature=5200                                     # white balance in Kelvin (ffmpeg ≥ 5.1)
curves=m='0/0.04 0.5/0.5 1/0.96'  | curves=preset=cross_process       # contrast / lifted blacks / film-like curves; r= g= b= for channels
curves=all='0/0 0.25/0.2 0.75/0.82 1/1'                               # gentle S-curve
hue=h=10:s=1.2                                                         # rotate hue (degrees), saturation
selectivecolor=reds=0 0 0 0:…                                          # per-colour-range CMYK-style adjust
colorchannelmixer=…                                                    # matrix mixing (B&W with custom weights, tints)
lut3d=file=look.cube                                                   # apply a 3D LUT (.cube/.3dl)
vignette=angle=PI/5   noise=alls=8:allf=t+u   unsharp=5:5:0.8:3:3:0.0   gblur=sigma=0.8
```
Preview a grade on one frame fast: `ffmpeg -ss 5 -i in.mp4 -frames:v 1 -vf "<filters>" test.png` and look at it.

## Looks (starting points; presets exist in build_timeline.py)
| look | recipe idea |
|---|---|
| cinematic teal-orange | lift blue in shadows, warm highlights, contrast 1.1, slight vignette, blacks lifted to ~0.02 |
| anime vivid | saturation 1.3–1.5, contrast 1.1, light unsharp, small bloom (`glow`) |
| pastel / soft | contrast 0.92, brightness +0.05, lifted blacks 0.08, saturation 1.1 |
| noir | `hue=s=0`, contrast 1.3–1.4, vignette strong |
| warm nostalgic | `colorbalance` +R/−B in mids, blacks lifted, grain (alls 6–8), saturation 0.92 |
| cold thriller | −R/+B mids, desaturate 0.85, contrast 1.15, crushed blacks |
| day-for-night | exposure −1 stop (`eq=brightness=-0.25`), blue tint, contrast up, vignette; fake only wide shots |

## Matching shots (the invisible craft)
* Pick a **hero shot** and match others to it: compare mean luma and white balance (`signalstats` filter prints YAVG/UAVG/VAVG):
  `ffmpeg -i clip.mp4 -vf "signalstats,metadata=print:file=-" -f null - | grep -E "YAVG|UAVG|VAVG" | head`
* Nudge exposure with `eq=brightness`, balance with `colorbalance`/`colortemperature` per clip (`clip.grade` object with `vf`).
* Auto-levels as a first pass on dull footage: `normalize=blackpt=black:whitept=white:smoothing=30` (temporal smoothing avoids flicker).

## LUTs
`lut3d=file=look.cube` — apply *after* exposure/white-balance fixes and match the LUT's expected input space (log LUTs expect log footage;
using one on Rec.709 footage looks wrong). Blend strength: split + `blend=all_mode=normal:all_opacity=0.6`. Timeline: `"grade": "looks/film.cube"`.

## Colour-space hygiene
* Most phone/web footage is already BT.709 SDR; nothing to convert. Tag the output anyway.
* RGB sources (PNG/Remotion/Pillow) → YUV: use `-vf scale=out_color_matrix=bt709:flags=lanczos,format=yuv420p` to avoid washed/saturated mismatches;
  add `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`.
* Washed-out or too contrasty on some players = range/matrix mismatch: check `ffprobe` color_range (tv vs pc/jpeg) and color_space.
* `yuvj420p` (full-range JPEG-style) → convert: `-vf scale=in_range=pc:out_range=tv,format=yuv420p`.
* 10-bit sources: `format=yuv420p` for delivery (dither: `scale=…:flags=…+accurate_rnd+full_chroma_int` when banding appears; add light `noise`/`deband`).

## HDR → SDR (iPhone HLG/Dolby Vision, PQ footage)
Detect: `probe_media.py` flags `color_transfer` smpte2084 (PQ) / arib-std-b67 (HLG).
```bash
ffmpeg -i hdr.mov -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" \
       -c:v libx264 -crf 18 -colorspace bt709 -color_primaries bt709 -color_trc bt709 sdr.mp4
```
If ffmpeg answers `no path between colorspaces`, the file carries no colour tags; declare them in front of the chain
(tested): `setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc:range=tv,zscale=t=linear:npl=100,…`
(HLG: `color_trc=arib-std-b67`).
Needs `zscale` (libzimg) — `check_env.sh` reports it. Without it, use `scale` + `colorspace` filter (lower quality) or ask the user for SDR export.
Mixing HDR and SDR clips without tone-mapping gives dull/blown-out clips.

## Checks
* Waveform: `ffmpeg -i in.mp4 -vf "waveform=filter=lowpass:scale=digital" -frames:v 1 wf.png`
* Vectorscope for skin line: `-vf "vectorscope=mode=color2"`
* Contact sheet before/after at the same timestamps; view at thumbnail size to judge the overall palette.
