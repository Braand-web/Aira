# Anime production — look, motion language, effects, and how to make anime video with whatever tools you have

Read when the request mentions anime, AMV, manga/comic motion, sakuga, cel look, key art animation, lyric/music videos
with an anime aesthetic, or "make it feel like an anime".
Contents: what makes it "anime" · pipeline · capability discovery (what can I actually generate?) · build routes ·
shot recipes · effects toolbox · colour & light · camera · sound · AMV editing · consistency · legal/ethical notes

## What makes footage read as anime
| trait | how it shows up | how to reproduce |
|---|---|---|
| **Limited animation / on twos & threes** | 12 or 8 distinct drawings per second inside a 24 fps timeline; holds are normal | `anime_fx.py --fx twos:n=2` (or `n=3`); keep camera moves smooth on ones for contrast |
| **Held poses + selective fluidity** | most shots nearly still, a few beats ("sakuga") very fluid | spend motion budget on 1–2 hero moments per scene; hold the rest |
| **Impact frames** | 1–3 frames of high-contrast ink/negative/white-out on a hit | `anime_fx.py --fx impact` / `--preset hit` |
| **Smears & speed lines** | motion is drawn as distortion/lines, not blur | `anime_fx.py speedlines` plate + `blend:"screen"`; short `tmix` smear on fast pans |
| **Camera shake & zoom punches** | on hits, explosions, stomps | `shake`, `punch` (decaying envelopes) |
| **Flat colour + hard shadow shapes** | 2–3 tone cel shading, ink outlines | AI/hand art, or `cel` filter for live footage |
| **Painted backgrounds + cel layer** | characters sit on detailed painted BG; BG often pans behind a static character | `parallax.py` with BG far, character near |
| **Compositing ("photography") pass** | bloom/diffusion, soft vignette, chromatic fringing, film grain, lens flares, colour-graded sky | `glow`, `vignette`, `chroma`, `grain` — subtle (mix 0.25–0.45) |
| **Exaggerated timing** | fast anticipation, snappy action, long settle | easeOutExpo + overshoot; see `motion-design.md` |
| **Typography** | bold angular titles, vertical Japanese-style subtitles, impact text | `ass_titles.py` glitch/pop/shake_in |

## Production pipeline (adapt to scope)
1. **Concept & beat sheet** — logline, tone, length, platform. Music first if it is a music video (BPM/sections drive structure).
2. **Storyboard / animatic** — one panel per shot with camera + action + duration (`assets/storyboard-template.md`).
   Build the animatic early (stills + timing + rough audio) with `build_timeline.py`; fix pacing *before* making final art.
3. **Assets** — character sheet (front/side/back, expressions, palette hex codes), background paintings, props, effect plates.
4. **Key motion** — per shot choose a route (below); animate the hero moments first.
5. **Compositing** — layers: BG → midground → character → FX (speed lines, particles) → lighting/glow → grade → grain.
6. **Edit** — cut to the beat, add impact frames/flashes/shakes on hits, transitions only where motivated.
7. **Sound** — music, SFX (whoosh, impact, cloth), ambience; duck music under dialogue.
8. **QA & delivery** — `qa_check.py`, contact sheet, platform export (`delivery-specs.md`).

## Capability discovery — decide the route from what exists
Run `scripts/check_env.sh`, then look at your own tools: is there an image-generation tool/API, an image-to-video or
video-generation tool/API, a text-to-speech tool, a Blender install, a GPU, ComfyUI/Stable-Diffusion tooling, or
user-supplied assets? **Do not promise what you cannot run.** State the route you will take and its limits in one sentence.
If web search is available and model/tool landscape matters (it changes fast), check current options before recommending.
Optional helpers when installed or installable: Real-ESRGAN (anime upscaling), RIFE (frame interpolation), rembg
(background removal for layer cut-outs), whisper/faster-whisper (captions), ComfyUI (node-based generation), Blender
(3D/NPR toon shading), Manim (diagram animation). Install via pip/npm only if the network allowlist permits.

## Build routes (best → most limited), pick per shot
**A. User-supplied or tool-generated animated clips** (image-to-video / video generation, hand-drawn, 3D toon render)
   → treat as footage: normalise (fps/res), `twos` if the clip is too smooth/AI-wobbly, `cel`/`glow`/`grain` pass for cohesion,
   interpolate/upscale if needed, then edit. Generate 3–6 s clips per shot, not long takes (consistency drifts). Keep the same
   character reference images, palette and seed/style prompt across all shots; reject shots where the face/outfit drifts.

**B. 2.5D parallax from layered stills** (`parallax.py`) — reliable, controllable, works with nothing but images.
   Needs layers: BG (opaque), midground (transparent PNG), character (transparent PNG), FX. Background removal (rembg) or
   painting-by-layer produces cut-outs. Add `bob` on the character for breathing; push-in 4–8 %; light-leak/glow overlay.
   This is the "motion comic / animated key-art" look and holds up well in music videos.

**C. Programmatic motion graphics** (Remotion, SVG/Canvas, Pillow frames) — kinetic type, HUD/UI, diagrams, geometric
   anime-style transitions (diagonal wipes, ink splashes, panel slides), lyric visualisers. Fully deterministic.

**D. Stylise live footage** (`cel` + `glow` + `grain`, `twos`) — rotoscope-ish look from real video. Cheap, quality varies; works
   best on high-contrast, well-lit footage; add outlines gently (`line` 0.08–0.14).

**E. Animatic / motion-comic** — stills cut to music with push-ins, panel wipes, speed lines, impact frames. A legitimate
   deliverable and the fastest path; set expectations that it is not full animation.

Say which route(s) you used in the delivery note.

## Shot recipes
**Hit / strike (1.2 s)**: anticipation hold (0.4 s, slight zoom-out) → speed ramp to 1.0 → at contact: `impact` ink 2 frames →
white flash 0.2 s → `shake` 0.5 s + `chroma` 0.25 s → radial `speedlines` plate for 0.6 s (on twos) → settle. Preset: `anime_fx.py apply … --preset hit --at T`.

**Power-up / charge**: slow push-in (1.0 → 1.15), `glow` mix ramping up (use two segments), vibration (`boil`, small `shake` amp 4–6 continuously),
rising audio riser; release with flash cut.

**Dramatic still (hold + camera)**: 3–5 s hold, camera crawl 1.0 → 1.05, wind/hair loop or light flicker overlay, vignette + grain; text appears on the exhale.

**Speed/dash**: parallel `speedlines` (`--style parallel`), BG motion-blurred with `tmix`, character smear frame (1–2 frames horizontally stretched) and a whoosh.

**Establishing shot**: wide painted BG, slow `pan_right 0.05` parallax, birds/clouds layer moving at its own speed, title fade, ambient SFX.

**Panel/manga transition**: diagonal `xfade` (`diagtl`, `wipetl`), or slice (`hlslice`), ≤ 0.35 s.

**Flashback**: desaturate to ~60 %, warm/bloom, soft vignette, slightly lower contrast, 12 fps feel (`twos`), muffled low-pass audio.

**Beat-flash montage**: cut every 1/2 beat in the chorus; 2-frame white or negative frame on each downbeat; 3–5 % zoom punch alternating.

## Effects toolbox (scripts/anime_fx.py)
`twos` `boil` `shake` `flash` `impact` `chroma` `glow` `grain` `vignette` `cel` `blur` `punch` `letterbox`, `speedlines` generator.
Principles: effects are *accents* — 90 % of the video should be calm so the 10 % hits. Layer order: look (cel) → glow → hit effects → grain last.
Overlay plates (speed lines, light leaks, sparkles): black background MP4 + timeline `overlay` with `"blend":"screen"`; transparent assets: ProRes 4444/WebM alpha with normal overlay.

## Colour & light
* Saturation up (1.2–1.45), contrast up a touch, blacks slightly lifted for the soft-painted feel (`curves=m='0/0.04 1/0.97'`).
* **Time of day palettes**: dawn = peach/pink + lavender shadows; noon = cyan sky + warm highlights; golden hour = orange key + teal-purple shadows;
  night = deep blue with magenta/cyan accent lights; interior = warm practicals vs cool windows.
* Rim light + bloom on edges sells "anime" even on simple shading. Hard-edged shadow shapes; avoid smooth gradients on skin.
* Use a **colour script**: one dominant hue per scene, accent complementary colour for the focus; keep a palette (5–7 hex codes) per project.
* Grade presets in `build_timeline.py`: `anime_vivid`, `pastel`, `dreamy`, `cinematic`, `noir`; refine with `lut` or raw `grade.vf`.

## Camera language
* Anime "camera" = pans/tilts across a painted BG, track-in/out (zoom), and dutch on action. Avoid constant handheld.
* Keep key shots on **ones or twos consistently** — mixing frame cadences within a shot looks like a bug.
* Cut rhythm: dialogue 2–4 s; action 0.3–1.2 s; contemplative holds 4–6 s. Use match cuts on silhouettes/shapes.
* Aspect: 16:9 default; 2.39:1 letterbox for cinematic/film-style; 9:16 for shorts (reframe — don't just crop).

## Sound
Anime relies on **SFX punctuation**: whooshes on camera moves, impact thumps on `impact` frames (+ 1-beat music dropout before), cloth/footstep foley,
ambience layers (wind, city, cicadas). Mix: dialogue/VO > SFX > music; duck music under speech; loudness −14 LUFS for online.

## AMV / music-video editing
Follow `editing-craft.md` → music-led edits; start from `autocut.py … --punch`, then hand-place: hero shots on chorus downbeats, speed ramps into drops,
impact frames on the biggest transients (`beat_detect.py` `onsets`), lyric text via `ass_titles.py` (`words`/`karaoke`).
Clip selection: match motion direction and energy across cuts; avoid reusing a moment; keep one grade across sources.

## Consistency checklist (AI-assisted or multi-source work)
- [ ] One character sheet; same outfit/colours/hairstyle across shots (compare thumbnails side by side via contact sheet)
- [ ] Same resolution/fps/aspect for all shots before editing; same grade at the end
- [ ] Hands/faces/text artefacts checked at full size on the shots that linger
- [ ] Style cohesion pass (`glow` + `grain` + `vignette` over everything) to glue disparate clips

## Rights & ethics
Don't reproduce existing characters, logos or franchise artwork, and don't imitate a named living artist's work to pass it off as theirs. Original
characters and generic "anime style" are fine. For music: user must hold rights or use licensed/royalty-free tracks for public release — mention it
when delivering a music-led edit built on commercial songs. Don't use real people's likeness without permission.
