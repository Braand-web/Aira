# ffmpeg cookbook — recipes you will actually need

Use `build_timeline.py` for assembly; use these for one-off operations, repairs and building blocks.
Contents: trimming · concat · normalising inputs · scaling/vertical · speed · transitions · overlays/PiP/split ·
text · alpha & keying · stabilise · audio · GIF/WebP · image sequences · encoding choices · analysis · visualisers

Conventions: `-y` overwrite; add `-hide_banner -loglevel warning -stats` to keep logs short. Always quote paths.
Filter expressions containing commas must be single-quoted: `enable='between(t,1,3)'`.

## Trimming
```bash
# Frame-accurate (re-encodes). -ss BEFORE -i is fast AND accurate when re-encoding.
ffmpeg -ss 00:00:12.5 -i in.mp4 -t 4 -c:v libx264 -crf 18 -c:a aac out.mp4
# Lossless & instant, but snaps to keyframes (start can be off by up to a GOP):
ffmpeg -ss 12.5 -to 16.5 -i in.mp4 -c copy -avoid_negative_ts make_zero out.mp4
```

## Concatenate
```bash
# Same codec/params, no re-encode (list.txt lines: file 'a.mp4'):
ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4
# Different sources → re-encode via filter (normalise first!). Prefer build_timeline.py.
ffmpeg -i a.mp4 -i b.mp4 -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" out.mp4
```

## Normalise messy inputs (do this when anything misbehaves)
```bash
# Variable frame rate (phone/screen recordings) → constant, plus even dims, yuv420p, 48k stereo
ffmpeg -i in.mov -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -crf 18 \
       -c:a aac -ar 48000 -ac 2 norm.mp4
# Bake rotation metadata into pixels: ffmpeg autorotates by default; to keep manual control add -noautorotate
# Non-square pixels: append ,setsar=1 after scaling
```

## Scaling, cropping, vertical/horizontal conversion
```bash
# 16:9 → 9:16 centre crop (loses sides)
ffmpeg -i in.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" out.mp4
# 16:9 → 9:16 keep everything: sharp video over blurred copy of itself
ffmpeg -i in.mp4 -filter_complex "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" out.mp4
# Fit inside 1920x1080 with black bars
-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
# Fill 1920x1080 by cropping the excess
-vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"
# Scope letterbox 2.39:1 on 1920x1080
-vf "crop=1920:804,pad=1920:1080:0:138:black"
# Upscale decently
-vf "scale=3840:2160:flags=lanczos"       # ML upscalers (Real-ESRGAN) beat this for anime stills/frames
```

## Speed
```bash
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" -map "[v]" -map "[a]" fast.mp4   # 2×
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=2.0*PTS[v];[0:a]atempo=0.5[a]" -map "[v]" -map "[a]" slow.mp4   # 0.5×
# Smooth slow-mo by synthesising frames (slow; blend is safer than mci for anime/line art)
-vf "setpts=4*PTS,minterpolate=fps=30:mi_mode=blend"
# atempo accepts 0.5–2.0 per instance: chain for more (atempo=2.0,atempo=2.0 = 4×)
# Reverse (loads whole clip in RAM — keep clips short): -vf reverse -af areverse
# Freeze a frame for 2 s at t=3: grab the frame, then use it as an image clip in the timeline
#   ffmpeg -ss 3 -i in.mp4 -frames:v 1 freeze.png   →  {"image":"freeze.png","duration":2}  (place between the two halves of the clip)
```

## Fades and transitions
```bash
-vf "fade=t=in:st=0:d=1,fade=t=out:st=9:d=1" -af "afade=t=in:d=1,afade=t=out:st=9:d=1"
# xfade needs identical size/fps/pixfmt/timebase. offset = (len of first) − (transition duration)
ffmpeg -i a.mp4 -i b.mp4 -filter_complex "[0:v][1:v]xfade=transition=fade:duration=1:offset=4[v];[0:a][1:a]acrossfade=d=1[a]" -map "[v]" -map "[a]" out.mp4
# list transitions this build supports: ffmpeg -h filter=xfade
```
Custom transition: `xfade=transition=custom:expr='...'` (per-pixel expression with A, B, P, X, Y, W, H, PLANE).

## Overlays, picture-in-picture, split screen
```bash
# Logo top-right, 30 px margin, 80% opacity
-filter_complex "[1:v]format=rgba,colorchannelmixer=aa=0.8[l];[0:v][l]overlay=W-w-30:30"
# PiP bottom-right at 25% width, visible only 2–8 s
-filter_complex "[1:v]scale=iw*0.25:-1[p];[0:v][p]overlay=W-w-40:H-h-40:enable='between(t,2,8)'"
# Side by side / grid
-filter_complex "[0:v][1:v]hstack=inputs=2"       |      "[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0"
# Blend modes for plates on black (glow, light leaks, speed lines): blend=all_mode=screen
```

## Text
```bash
# drawtext with fade + shadow; use textfile= to dodge escaping
-vf "drawtext=fontfile=/path/Font.ttf:textfile=t.txt:expansion=none:fontsize=72:fontcolor=white:x=(w-text_w)/2:y=h*0.8:shadowx=2:shadowy=2:alpha='min(1,(t-1)/0.4)':enable='between(t,1,4)'"
# Burn SRT / ASS
-vf "subtitles=captions.srt:force_style='FontName=Poppins,FontSize=26,Outline=2,MarginV=60'"      -vf "ass=titles.ass"
# Font lookup: fc-list : family | sort -u ; pass fontsdir=/path to ass/subtitles for bundled fonts
```
Auto-captions: `whisper audio.mp3 --model small --output_format srt` (openai-whisper) or faster-whisper; fix names/jargon by hand;
for word-pop captions feed word timestamps (`--word_timestamps True`) into `ass_titles.py` (`words` effect).

## Alpha, keying, masks
```bash
# Green screen
-filter_complex "[1:v]chromakey=0x00ff00:0.12:0.08,despill=type=green[fg];[0:v][fg]overlay"
# Export with transparency
ffmpeg -i in.mp4 ... -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov     # editing/compositing
ffmpeg -i in.mp4 ... -c:v libvpx-vp9 -pix_fmt yuva420p out.webm                          # web
# Image sequence with alpha → video: -framerate 24 -i f_%04d.png (PNG keeps alpha)
```

## Stabilise (two-pass)
```bash
ffmpeg -i shaky.mp4 -vf vidstabdetect=shakiness=6:result=t.trf -f null -
ffmpeg -i shaky.mp4 -vf "vidstabtransform=input=t.trf:smoothing=15:zoom=2,unsharp=5:5:0.8" -c:a copy steady.mp4
```

## Audio
```bash
-af "volume=0.5"   -af "volume=-6dB"
-af "highpass=f=80,lowpass=f=14000"                                  # clean rumble/hiss
-af "acompressor=threshold=-18dB:ratio=3:attack=10:release=200:makeup=3"   # even out speech
-af "equalizer=f=3000:t=q:w=1:g=3"                                    # presence
-af "silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.6:stop_threshold=-45dB"  # cut dead air
-af "adelay=1500|1500"                                                # delay 1.5 s (stereo)
-af "arnndn=m=model.rnnn"                                            # RNN denoise (needs a model file)
-af "afftdn=nf=-25"                                                   # built-in denoiser
# Duck music under voice (voice.wav = sidechain)
-filter_complex "[1:a][0:a]sidechaincompress=threshold=0.04:ratio=9:attack=25:release=450[m];[0:a][m]amix=inputs=2:duration=first:normalize=0"
# Replace/mux audio, keep video untouched
ffmpeg -i video.mp4 -i music.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest out.mp4
# Extract audio
ffmpeg -i in.mp4 -vn -c:a pcm_s16le audio.wav
```
Loudness: `scripts/loudnorm.py`. Details in `audio.md`.

## GIF / WebP / images
```bash
# Good GIF (palette), 12 fps, 640 wide
ffmpeg -i in.mp4 -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" out.gif
ffmpeg -i in.mp4 -vf "fps=15,scale=720:-1" -c:v libwebp_anim -loop 0 -q:v 70 out.webp     # smaller & better than GIF
ffmpeg -ss 5 -i in.mp4 -frames:v 1 -q:v 2 thumb.jpg                                          # single frame
ffmpeg -i in.mp4 -vf "fps=1,scale=320:-1" thumbs/%04d.png                                    # 1 per second
ffmpeg -framerate 24 -i frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 16 out.mp4      # image sequence → video
```

## Encoding choices
| goal | flags |
|---|---|
| universal web/social | `-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 192k` |
| smaller, modern | `-c:v libx265 -crf 23 -tag:v hvc1 -pix_fmt yuv420p` (Apple needs `hvc1`) |
| archive/edit master | `-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s16le` (.mov) |
| web, open codec | `-c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus` (.webm); AV1: `libsvtav1 -crf 32` |
| fast draft | `-preset ultrafast -crf 30` and half resolution |
| target file size | two-pass `-b:v` (bitrate = size_bits / duration − audio) |
| GPU | `h264_nvenc -cq 19`, `h264_videotoolbox -q:v 60`, `h264_vaapi` — quicker, slightly larger/lower quality; confirm hardware exists first |
CRF scale: 14–16 near-lossless, 18 high quality, 23 default, 28 low. Animation/flat colour: add `-tune animation`;
grainy film: `-tune grain`. Always `-pix_fmt yuv420p` for delivery, `-movflags +faststart` for MP4s on the web.

## Analysis & debugging
```bash
ffprobe -v error -show_format -show_streams -of json in.mp4         # everything (or scripts/probe_media.py)
ffmpeg -i in.mp4 -vf "blackdetect=d=0.1,freezedetect=n=0.003:d=0.5" -an -f null -     # black/frozen frames
ffmpeg -i in.mp4 -af "silencedetect=n=-50dB:d=1,ebur128=peak=true" -vn -f null -        # silence + loudness
ffmpeg -i in.mp4 -vf "cropdetect=24:16:0" -frames:v 300 -f null -                        # find black bars
ffmpeg -i in.mp4 -vf "select='gt(scene,0.4)',showinfo" -f null - 2>&1 | grep pts_time   # scene cuts
```
Hard to read the log? Add `-loglevel debug` only for the failing filter; start from the last error line.

## Visualisers (music videos, podcasts)
```bash
-filter_complex "[0:a]showwaves=s=1920x300:mode=cline:colors=white:rate=30[w];[1:v][w]overlay=0:H-h"
-filter_complex "[0:a]showcqt=s=1920x400:fps=30[v]" -map "[v]" -map 0:a
-filter_complex "[0:a]avectorscope=s=600x600:zoom=1.5:draw=line[v]"
# static waveform picture: -filter_complex "showwavespic=s=1600x300"
```
For audio-reactive animation (beat-pulsing graphics) use `beat_detect.py` timestamps to drive `eq`/`zoompan`
expressions, or `@remotion/media-utils` in Remotion (see remotion.md).
