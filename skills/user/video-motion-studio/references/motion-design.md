# Motion design — principles, timing, easing, kinetic typography

Read when designing any animation (titles, UI, infographics, logo stings, transitions) in ffmpeg, ASS or Remotion.
Contents: the rules that matter · timing table · easing library · choreography · kinetic typography ·
camera & depth · motion blur · implementing in ffmpeg / ASS / Remotion · common mistakes

## The rules that matter (distilled from the 12 principles of animation)
1. **Ease everything.** Real objects accelerate and decelerate. Linear motion looks robotic (exceptions: spinning loops,
   conveyor/scroll). Entrances: ease-**out** (fast then settle). Exits: ease-**in** (slow then fast). Moves between two rest
   states: ease-in-out.
2. **Anticipation → action → follow-through.** A small opposite move before the main move (wind-up), overshoot after (settle).
   A 4–8 % overshoot on a pop reads as "alive"; 20 %+ reads cartoonish.
3. **Stagger, don't synchronise.** Items entering together should be offset 3–6 frames (40–80 ms) in reading order.
   Overlap actions: the next begins before the previous finishes.
4. **Arcs, not straight lines** for organic motion; straight for mechanical/UI.
5. **Squash & stretch** conserves volume: scaleX up ⇒ scaleY down slightly. Use for bounces, punches, logo pops.
6. **Staging & hierarchy**: one hero per moment. Dim/blur/slow everything else. Motion draws the eye — don't animate three things equally.
7. **Timing sells weight.** Fast = light/energetic, slow = heavy/premium. Hold still frames — rest makes motion readable.
8. **Secondary action** (grain, particles, subtle bob/parallax, glow pulse) adds life without stealing focus.
9. **Consistency**: one easing family and duration scale per project, one motion language (all slides from the same side).
10. **Exaggerate a little** — viewers underestimate subtle motion at video scale.

## Duration guide (at 24–30 fps)
| element | duration | frames @30 |
|---|---|---|
| micro-feedback (button, tick) | 100–200 ms | 3–6 |
| text/line entrance | 250–450 ms | 8–14 |
| UI panel/card move | 300–500 ms | 9–15 |
| scene transition | 400–800 ms | 12–24 |
| big title reveal | 600–1200 ms | 18–36 |
| exit | ~70 % of entrance | |
| stagger offset | 40–80 ms | 1–3 per item (up to 6) |
| hold after reveal (to read) | ≥ 1 s per ~3 words | |
Slow-in/slow-out slope matters more than total duration: if it feels abrupt, steepen the ease, don't just lengthen.

## Easing library (cubic-bezier x1,y1,x2,y2)
| name | curve | use |
|---|---|---|
| easeOutExpo | 0.16, 1, 0.3, 1 | **default entrance**; punchy start, silky landing |
| easeOutQuart | 0.25, 1, 0.5, 1 | calmer entrance |
| easeInOutCubic | 0.65, 0, 0.35, 1 | moves between rest states, camera drifts |
| easeInCubic | 0.32, 0, 0.67, 0 | exits |
| easeOutBack | 0.34, 1.56, 0.64, 1 | pop with overshoot |
| easeInOutBack | 0.68, -0.6, 0.32, 1.6 | playful, anticipation + overshoot |
| spring (damping≈18, stiffness≈220, mass≈0.7) | — | UI-like; Remotion `spring()` |
Closed forms (progress p∈[0,1]): out-cubic `1-(1-p)^3` · in-cubic `p^3` · smoothstep `p*p*(3-2p)` · out-expo `1-2^(-10p)`.

## Choreography recipes
* **Title reveal**: words stagger 5 frames, each `translateY 60 → 0` + scale 0.8 → 1 + opacity 0 → 1 (easeOutExpo); underline wipes 0 → 100 % after 12 frames; subtitle fades in last.
* **Lower third**: bar slides in (300 ms) → text wipes/fades after 100 ms → holds 3–4 s → text out first, bar out 100 ms later.
* **Number counter**: ease-out from 0 to value over 1–1.5 s with tabular figures; pulse (scale 1 → 1.06 → 1) on landing.
* **Bar/line chart**: each bar grows with easeOutBack, staggered 4 frames; the highlighted bar finishes last and glows.
* **Logo sting** (2–3 s): shapes assemble with overshoot → 1-frame flash/glint sweep → settle → hold 0.8 s.
* **Whip/slide transition**: outgoing moves out with ease-in while blurred (motion blur), incoming settles with ease-out; match direction.
* **Beat-reactive pulse**: scale 1 → 1.05 on each beat, decaying with `exp(-8t)` — tie to `beat_detect.py` timestamps.

## Kinetic typography
* Choose hierarchy by size/weight, not by many colours. Emphasis word: bigger, bolder or accent colour.
* **Word-by-word** captions: reveal each word on its spoken timestamp, newest word pops (scale 60 → 115 → 100 %).
* **Lines**: break by phrase/meaning, ≤ 2 lines on screen, ≤ ~32 chars per line vertical / ~42 horizontal.
* **Typewriter** only for code/terminal/typed-message contexts; ~15–20 chars/s.
* **Glitch** (RGB split + positional jitter for 0.2–0.4 s) for tech/cyber/AMV hits; don't leave it on.
* **Mask reveals** (text wipes in from a line) feel premium; blur-in (blur 30 → 0 with fade) feels dreamy.
* Tools: `ass_titles.py` (effects: pop, slide_up, slide_left, fade, blur_in, typewriter, words, glitch, karaoke, shake_in);
  Remotion for anything data-driven or with shapes.
* ASS `\fs` is font *line height*, not cap height: fonts with tall metrics (Poppins) look ~30 % smaller at the same number. Check a still.

## Camera & depth
* Even on flat artwork, add slow camera motion: push-in 1.00 → 1.06 over the shot (ease-in-out) keeps stills alive.
* **Parallax** — near layers move more than far layers (`parallax.py`; depth factor 0.1 sky … 1.0 foreground).
* **Rack focus feel**: blur the background layer a touch (gblur 2–6 px) and keep the subject sharp.
* **Shake** only on impacts: decaying (exp) envelope, 8–20 px at 1080p, 20–30 Hz, 0.3–0.6 s.
* **Dutch/roll** small (2–4°) adds tension; return to level on release.

## Motion blur
Moving fast without blur strobes. For synthetic motion (Remotion/ffmpeg expressions) add blur: render at 2–4× frame rate
and blend down (`tmix`/`fps` with `blend`) or use `tblend=all_mode=average`. Cinematic shutter = 180° (exposure = 1/(2·fps)).
Anime deliberately uses *less* blur and more smears/speed lines — see `anime-production.md`.

## Implementing

### ffmpeg expressions
Progress `p = clip(t/dur,0,1)`; eased `e = 1-pow(1-p,3)`. Examples:
```
x='(W-w)/2'  y='H*0.7 + 60*pow(1-min(1,(t-1)/0.45),3)'          # slide up from below, ease-out
alpha='min(1,max(0,(t-1)/0.35))'                                  # fade in at t=1
zoompan z='1+0.15*(1-pow(1-on/119,3))'                            # eased push-in over 120 frames
eq=brightness='gte(t,2)*max(0,1-(t-2)/0.2)':eval=frame            # decaying flash at t=2
```
`build_timeline.py` titles/zoom already apply these; `anime_fx.py` has shake/flash/punch with envelopes.

### ASS (libass)
`\move(x1,y1,x2,y2,t1,t2)`, `\t(t1,t2,\accel,tags)` animates tags (`\fscx \fscy \alpha \blur \frz`), `\fad(in,out)`.
`\t` with `\accel0.5` ≈ ease-out, `\accel2` ≈ ease-in.

### Remotion
`interpolate(frame,[0,20],[0,1],{easing:Easing.bezier(...),extrapolateRight:'clamp'})`, `spring({frame,fps,config})`,
`<Sequence from>` for offsets, `@remotion/transitions` for scene transitions. See `remotion.md`.

## Common mistakes
* Linear motion; everything animating at once; identical easing on in and out; transitions longer than the shots they join.
* Text that animates for longer than it is readable; centred motion that ignores reading order.
* Overshoot on serious/corporate content; no overshoot on playful content.
* Forgetting the hold: the scene ends the moment the animation ends. Add 0.5–1 s rest.
* Animating at one frame rate and rendering at another → judder. Decide fps first (24 cinematic/anime, 30 web, 60 UI/gaming).
