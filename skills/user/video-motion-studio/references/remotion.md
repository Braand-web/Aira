# Remotion — programmatic motion graphics in React

Use when the video is **data-driven, templated, text/shape-heavy, or needs fine-grained deterministic animation**:
kinetic typography, charts, lower-thirds packs, HUD/UI, lyric/visualiser videos, personalised batches (1 template × N rows).
Use plain ffmpeg/`build_timeline.py` for footage assembly; they combine well (render Remotion → MP4/ProRes-alpha → overlay it).

Contents: decide · setup · core API · patterns · audio · assets · render · performance · troubleshooting · ffmpeg handoff

## Decide
| need | use |
|---|---|
| cut footage, titles, music, grade | `build_timeline.py` |
| animated text with a few effects | `ass_titles.py` |
| data viz, shapes, UI, templated batches, custom easing/physics | **Remotion** |
| layered still → camera move | `parallax.py` |
Remotion needs Node ≥ 18 and downloads a headless Chrome on first render (needs network; blocked sandboxes cannot render —
check with `check_env.sh` and a quick `npx remotion still` before promising output; if blocked, fall back to ASS/ffmpeg or ask the user to render locally).

## Setup
```bash
cp -r <skill>/assets/remotion-starter ./my-video && cd my-video
npm install
npm run studio                 # live preview (interactive; humans only)
npm run still                  # one PNG: render + LOOK at it before rendering video
npm run render                 # → out/promo.mp4 (H.264, CRF 18)
```
The starter (type-checked against Remotion 4) has: `Root.tsx` (compositions, incl. vertical variant), `Promo.tsx`
(TransitionSeries; staggered word spring; eased bars; push-in), `easing.ts` (named curves, spring presets). Duplicate a scene and edit.
New project from scratch: `npx create-video@latest` (interactive) — prefer copying the starter in automation.
Pin versions: all `remotion` and `@remotion/*` packages must share the **same exact version**.

## Core API (v4)
```tsx
const frame = useCurrentFrame();                        // 0-based frame inside the current <Sequence>
const {fps, width, height, durationInFrames} = useVideoConfig();
interpolate(frame, [0, 20], [0, 1], {easing: Easing.bezier(0.16,1,0.3,1), extrapolateLeft:'clamp', extrapolateRight:'clamp'});
spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 220, mass: 0.7}});   // 0 → 1 with physical overshoot
<Sequence from={30} durationInFrames={60}>…</Sequence>  // time-shifts children (their frame restarts at 0)
<AbsoluteFill style={{…}}/>                              // full-frame layer; stack for layers
<Series> / <TransitionSeries> (@remotion/transitions: fade, slide, wipe, flip, clockWipe; timing: linearTiming, springTiming)
<Img src={staticFile('a.png')}/> <OffthreadVideo src=…/> <Audio src=… volume={f=>…}/> (never plain <img>/<video>: frames must be awaited)
random('seed')  // deterministic randomness; Math.random() breaks reproducible renders
```
Rules: animation = pure function of `frame` (no setTimeout/CSS transitions/CSS animations — they won't render deterministically).
Total duration of a `TransitionSeries` = Σ sequences − Σ transitions.

## Patterns
* **Stagger**: `spring({frame: frame - i*5, …})` per child.
* **Data-driven**: props from `defaultProps` or `--props='{"title":"Hi"}'`; map rows → compositions for batch renders.
* **Responsive layout**: size from `width`/`height` (not px constants) so 16:9 and 9:16 share one component.
* **Looping**: `frame % period`; make start = end for seamless loops.
* **Camera**: wrap scene in a div with `transform: scale()/translate()` driven by an eased progress.
* **Motion blur**: `@remotion/motion-blur` `<CameraMotionBlur>`/`<Trail>` for fast moves.
* **Fonts**: `@remotion/google-fonts/<Family>` (`loadFont()`); local fonts via `@font-face` + `staticFile` and `delayRender`.
* **Shapes/paths**: `@remotion/shapes`, `@remotion/paths` (stroke-draw: `evolvePath`).
* **Lottie**: `@remotion/lottie` for AE-exported animations.
* **Captions**: `@remotion/captions` + whisper JSON → word-highlight components.

## Audio-reactive
```tsx
import {useAudioData, visualizeAudio} from '@remotion/media-utils';
const audio = useAudioData(staticFile('song.mp3'));
if (!audio) return null;
const bars = visualizeAudio({fps, frame, audioData: audio, numberOfSamples: 32});   // array of 0..1 amplitudes
```
Or precompute beats with `beat_detect.py` → JSON → `import beats from './beats.json'` → pulse on frames `Math.round(t*fps)`.

## Assets
Put files in `public/` and reference with `staticFile('name.ext')`. Remote URLs work but add flakiness — download first.

## Render
```bash
npx remotion render src/index.ts Promo out/promo.mp4 --codec=h264 --crf=18 --props='{"title":"Hello"}'
npx remotion render … --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le out/promo.mov   # transparent
npx remotion render … --codec=vp8 / vp9 out.webm                                                                           # web alpha (check support)
npx remotion render … --frames=0-59                                    # test a range    |    --scale=0.5 for half-res drafts
npx remotion render … --concurrency=4                                  # CPU threads
npx remotion still src/index.ts Promo out/frame.png --frame=45          # single image to inspect
```
Output with audio: Remotion muxes `<Audio>` tracks; check loudness afterwards (`loudnorm.py`).

## Performance
`--scale=0.5` + `--frames` ranges for drafts; avoid huge unoptimised images (resize first); use `OffthreadVideo` for video;
avoid `filter: blur()` on huge layers every frame (costly); lower `--concurrency` if memory is tight; Lambda/cloud rendering is for scale.

## Troubleshooting
| symptom | cause / fix |
|---|---|
| "Could not download browser/compositor", ENOTFOUND | network allowlist blocks the download; use another route or render on the user's machine |
| Flicker / missing image in frame | use `<Img>`, wrap async loads in `delayRender()/continueRender()` |
| Version mismatch error | align every `remotion*` package to the same exact version |
| Animation jumps at Sequence boundaries | child `frame` restarts at 0 inside `<Sequence>`; compute relative timing |
| Audio out of sync | set `fps` consistently; don't mix fps; trim audio with `startFrom`/`endAt` |
| Render much slower than studio | lower resolution preview; reduce effects; check `--concurrency` |

## ffmpeg handoff
Render graphics → `out.mov` (ProRes 4444 alpha) → `build_timeline.py` overlay (normal blend, alpha respected) or composite directly:
`ffmpeg -i bg.mp4 -i gfx.mov -filter_complex "[0:v][1:v]overlay" -c:a copy out.mp4`.
Remotion for the whole film is also valid: put footage in with `<OffthreadVideo>`; use ffmpeg only for final loudness/format.
