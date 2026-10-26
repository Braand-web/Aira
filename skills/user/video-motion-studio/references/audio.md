# Audio for video — loudness, music, ducking, cleanup, beat grids

Contents: targets · workflow · music selection & sync · beat grid verification · ducking · cleanup · SFX · common problems

## Loudness targets (integrated LUFS / true peak)
| destination | LUFS | true peak |
|---|---|---|
| YouTube, Instagram, TikTok, general streaming | **−14** | **−1.5 dBTP** (−1 is the spec; −1.5 leaves headroom for AAC re-encode) |
| Podcast / voice-only | −16 (stereo) / −19 (mono) | −1.5 |
| Broadcast (EBU R128) | −23 | −1.0 |
| US broadcast (ATSC A/85) | −24 | −2.0 |
| Cinema/trailers online | −16 to −18 | −1.5 |
Platforms normalise *down* if you are louder than their target and mostly leave quieter content alone, so don't squash dynamics chasing loudness.
Check with `scripts/loudnorm.py in.mp4 --measure-only` or `qa_check.py`.

## Workflow
1. Clean dialogue (high-pass 80 Hz, denoise if needed, gentle compression).
2. Edit/cross-fade audio at cuts (5–30 ms fades to kill clicks; longer for ambience).
3. Add music (duck under speech) and SFX.
4. Master: limiter at −1 dBFS → two-pass loudnorm (`"loudnorm"` in the timeline, or `loudnorm.py`).
5. Verify: `qa_check.py` (peaks, silence, loudness).

## Music: choosing and syncing
* Match mood and tempo to the cut rhythm: 90–110 BPM calm, 120–130 energetic, 140+ intense.
* Pick the start offset deliberately (`audio.music.start`) — begin on a downbeat or a riser.
* Ending: let the track resolve under the final image; fade the last 1.5–2 s (`fade_out`) unless the track ends cleanly on a hit.
* Loops: `loop:true` repeats; use only for ambient beds. Cross-fade loop points if audible.
* Licensing: user must have rights for public release; prefer royalty-free libraries when unsure.

## Beat grid (cut-on-beat)
```bash
python3 scripts/beat_detect.py song.mp3 --out beats.json         # bpm, beats, downbeats, onsets
python3 scripts/beat_detect.py song.mp3 --cuts 24 --min-gap 0.5   # N strong cut points
python3 scripts/beat_detect.py song.mp3 --bpm 128 --offset 0.05   # correct a wrong tempo / constant offset
```
Accuracy: tested within ~20 ms on steady-tempo material. Weak spots: rubato/live tempo drift, ambient intros, half/double-time ambiguity
(pass `--bpm` or `--bpm-range`). Beats assume a steady grid; for tempo-changing music, cut by `onsets` instead.
**Verify before cutting a whole video to the grid** (an agent can't listen, so use numbers, and render clicks for the user/QA):
```bash
python3 scripts/click_track.py song.mp3 beats.json --report            # grid-vs-onset error in ms + drift check → GOOD / CHECK
python3 scripts/click_track.py song.mp3 beats.json -o check_clicks.wav  # ticks on every beat (higher tick on downbeats) over the song
```
Tested: correct grid → mean error ≈ 6 ms; deliberately wrong BPM → flagged CHECK (60 ms, only half the onsets match).
Cuts should land 1–2 frames *before* the beat to feel on-time (human perception forgives early). Subtract ~0.05 s from `beats`
if the cut feels late.

## Ducking (music under speech)
`audio.music.duck:true` in the timeline (sidechain compress: threshold 0.04, ratio 9, attack 25 ms, release 450 ms).
Voice-over supplied separately? Put it in the same timeline as clips' audio or mix manually:
```bash
ffmpeg -i vo.wav -i music.mp3 -filter_complex "[1:a][0:a]sidechaincompress=threshold=0.03:ratio=10:attack=20:release=400[m];[0:a][m]amix=inputs=2:duration=first:normalize=0" mix.wav
```
Manual keyframe ducking (precise): `volume='if(between(t,3,8),0.25,1)':eval=frame` (smooth with `afade` or a ramped expression).
Music level when speech plays: roughly 12–18 dB under the voice; check intelligibility on laptop speakers/phone, not just headphones.

## Cleanup
| problem | try |
|---|---|
| rumble, mic bumps | `highpass=f=80` |
| hiss | `afftdn=nf=-25` (built-in) or `arnndn` with a model |
| harsh sibilance | `equalizer=f=7000:t=q:w=2:g=-4` or a de-esser (`deesser`) |
| boxy voice | `equalizer=f=300:t=q:w=1:g=-3` |
| uneven level | `acompressor=threshold=-18dB:ratio=3:attack=10:release=200:makeup=3`, then loudnorm |
| clicks/pops | `adeclick`, `adeclip` |
| echo/room | hard; try `afftdn` + EQ; otherwise re-record |
| dead air | `silenceremove` (see cookbook) |

## SFX
Layer small, short sounds: whoosh on camera/transitions (start ~3–5 frames before the visual lands), impact on hits (+ sub thump), UI ticks
on text pops, risers into drops. Keep SFX 6–12 dB under dialogue. Generate synthetic stand-ins if no library exists:
```bash
ffmpeg -f lavfi -i "anoisesrc=d=0.6:c=pink:a=0.5,highpass=f=300,lowpass=f=6000,afade=t=in:d=0.25,afade=t=out:st=0.25:d=0.35" whoosh.wav
ffmpeg -f lavfi -i "sine=f=55:d=0.35,afade=t=out:d=0.3,volume=1.5" thump.wav
```
(Synthetic SFX are placeholders — tell the user to swap in real library sounds for a polished result.)

## Common problems
* **Audio longer/shorter than video** → check `qa_check.py av_sync`; use `-shortest` or pad with `apad` + `-t`.
* **Pops at cuts** → add 10 ms `afade` in/out per clip, or crossfade.
* **Loudness lower than target** → peak-limited; compress/limit earlier, or accept (don't clip).
* **Mono source in stereo project** → `aformat=channel_layouts=stereo` (done in timeline) duplicates to both channels.
* **Sample-rate mismatch** → always `aresample=48000` (done in timeline).
