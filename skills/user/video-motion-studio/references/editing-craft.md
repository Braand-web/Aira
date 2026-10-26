# Editing craft — decisions that make an edit feel professional

Technical correctness is table stakes; this file is about *taste*. Read it when planning an edit, choosing
pacing, or reviewing a cut that "works but feels off".

Contents: the planning questions · structure · pacing · cutting rules · music-led edits · social/vertical ·
text on screen · sound · review checklist

## Before touching footage: five questions
1. **Purpose** — what should the viewer think/feel/do at the end? (Sell, explain, move, entertain.)
2. **Audience & platform** — decides aspect ratio, length, pace, caption need (see `delivery-specs.md`).
3. **Length budget** — pick a number first (e.g. 30 s). Every shot must earn its seconds.
4. **Hook & payoff** — what is the first 2 seconds? what is the last image people remember?
5. **Assets in hand** — footage, stills, music, voice-over, brand rules (fonts, colours, logo). Probe everything.

Write a 6–12 line shot list / storyboard (`assets/storyboard-template.md`) before building. Cheap to change, expensive later.

## Structure templates
| format | skeleton |
|---|---|
| 15–30 s social ad | hook (0–2 s) → problem/curiosity → payoff/product → CTA (last 3 s) |
| 60–90 s explainer | cold open → context → 3 beats of "claim + visual proof" → recap → CTA |
| trailer / hype | slow build → rising tempo cuts → silence-drop → hit montage → title card |
| AMV / music montage | intro (hold) → verse (medium pace, story) → pre-chorus (accelerate) → chorus (fastest, best shots, flashes) → outro |
| vlog / interview | strongest line first → context → story with b-roll covering jump cuts → button |
| product demo | outcome first → 3 features, each 5–8 s, UI zooms → social proof → CTA |

## Pacing (numbers to start from, then adjust by feel)
* Average shot length: calm 4–8 s · dialogue 3–6 s · energetic social 1–2.5 s · action/AMV chorus 0.3–1 s.
* Vary it. Monotone cutting numbs; accelerate into peaks, hold after them.
* A shot needs enough time to be *read*: ≥ ~1 s for a new scene, ≥ 2 s if it carries text.
* On-screen text: ~3 words/second reading speed; hold 1 s extra. Titles ≥ 1.5 s even if short.
* Cut dead air: remove breaths/ums/pauses > 0.4 s in talking-head; keep deliberate silence for drama only.

## Cutting rules (and when to break them)
* **Cut on action**: switch angle mid-movement; motion hides the seam.
* **Match cut**: same shape/position/motion across the cut (door → door, wheel → clock). Strong transitions without effects.
* **Don't jump-cut similar framings** (same size, same angle) unless it's a deliberate jump-cut style; change size ≥ 30% or angle ≥ 30°.
* **Shot variety**: wide (where), medium (who), close (feel), insert/cutaway (detail). Sequence rhythm: W–M–C–insert.
* **Screen direction**: keep subjects moving the same direction across cuts unless showing a reversal (180° rule).
* **J-cut / L-cut**: let audio lead (J) or trail (L) the picture by 0.3–1 s; the single biggest "smooth" trick for dialogue. In build_timeline: handle by placing voice-over/music as an audio track independent of clips (clips `audio:false`).
* **Cut on the beat** for music-led edits, ± 1–2 frames *early* (the eye forgives early, not late): shift cut ~2 frames before the beat.
* **Transitions**: 80%+ hard cuts. A transition must mean something (time jump = dissolve, chapter = fade through black).
* **Reaction/hold**: after the big moment, hold one extra beat so it lands.
* **Rule of thirds / headroom / lead room**: crop with `fit:"cover"` and a zoom focus (`zoom.x/y`) to re-frame subjects on thirds.

## Music-led edits
1. `beat_detect.py` → BPM + beat grid; verify (click track, see `audio.md`).
2. Choose cut density per section: verse every 4 beats (1 bar), pre-chorus every 2, chorus every 1 (or 1/2).
3. Put the *best* footage on the downbeats of the chorus/drop. Put a flash/impact (`anime_fx.py --preset hit`) on the biggest hit.
4. Hide repetition: never reuse the same 2 seconds of source; rotate sources (`autocut.py` does this).
5. Add motion variety: alternating push-in/pull-out (`--punch`), speed ramps into drops, a 1-beat freeze before the drop.
6. Drop the music out for 1–2 beats before the final hit — contrast creates impact.

## Social / vertical (9:16)
* Hook in ≤ 2 s: movement + big text or a surprising frame. No logo intros.
* Safe zones: keep key content out of the top ~14 % and bottom ~25 % (UI overlays) and ~6 % of the sides.
* Captions on by default (most watch muted): 2 lines max, high contrast, word-pop style engages. Size ≥ 6 % of frame height.
* Pace ≥ 1 visual change per 1.5–3 s (cut, zoom, text pop, B-roll).
* End on a loopable frame or a clear CTA.

## Text on screen
* Contrast first: white + 2–3 px dark outline/shadow or a semi-opaque box beats any fancy colour.
* 1–2 typefaces max; bold sans for headlines; consistent position per text type (lower-thirds always same place).
* Entrance ≈ 0.25–0.4 s ease-out; exit ≈ 0.2 s ease-in; don't animate text while the viewer must read it.
* Keep inside title-safe (≥ 5 % margin). Check on the contact sheet at thumbnail size: if unreadable there, it's too small.

## Sound is half the picture
* Dialogue/VO sits at about −16 LUFS-equivalent loudness; music 12–18 dB under speech while speaking (duck), full level in gaps.
* Add room tone/ambience under cuts so silence isn't digital-black; add small SFX (whooshes on transitions, hits on impacts) — mixed low.
* Fade audio at the very start/end (5–30 ms) to avoid clicks; finish with the loudness pass.

## Review checklist (run before delivering)
- [ ] Hook works in the first 2 s (look at frames 0–60 on the contact sheet)
- [ ] No unintended black/frozen frames, no flash frames, no duplicated shots
- [ ] Text legible at thumbnail size, inside safe margins, no typos (read every string)
- [ ] Audio: no clipping, speech intelligible over music, consistent loudness, no dead air
- [ ] Colour consistent across shots (one grade, matched exposure)
- [ ] Duration & format match the brief; `qa_check.py` is PASS/understood WARN
- [ ] Ending lands (hold, fade, CTA, loop)
