# @snailicid3/video-intelligence-viewer

React components for visualising
[Google Cloud Video Intelligence API](https://cloud.google.com/video-intelligence) annotations — a
React port of Zack Akil's
[video-intelligence-api-visualiser](https://github.com/ZackAkil/video-intelligence-api-visualiser).

Supported annotation features:

- **Shot detection** — timeline of shots with current-shot highlighting.
- **Label detection** — per-label segment timeline + live "current labels" list.
- **Person detection** — bounding boxes + landmarks on the canvas overlay.
- **Object tracking** — bounding boxes + entity labels on the canvas overlay.
- **Text detection** — rotated bounding boxes + the detected string on the canvas overlay.
- **Speech transcription** — word-by-word transcript with the current word highlighted; click to
  seek.

All overlay geometry is interpolated between sampled frames and driven by the video's `currentTime`;
a shared confidence slider gates every feature.

## Usage

```tsx
import { VideoIntelligenceViewer } from '@snailicid3/video-intelligence-viewer'

export const App = () => <VideoIntelligenceViewer />
```

Everything runs client-side:

- **Load video** — pick a local video file (kept in-browser via an object URL; nothing is uploaded).
- **Load annotations (JSON)** — pick a Video Intelligence API output file; it's parsed and validated
  in the browser.

You can also seed data up front, from a raw string or a CORS-enabled URL:

```tsx
import {
  fetchAnnotations,
  parseAnnotations,
  VideoIntelligenceViewer,
} from '@snailicid3/video-intelligence-viewer'

const annotations = parseAnnotations(rawJsonString)
// or, from a remote URL:
const remote = await fetchAnnotations('https://example.com/annotations.json')

;<VideoIntelligenceViewer
  defaultThreshold={0.5}
  initialAnnotations={annotations}
  videoSrc="/clip.mp4"
/>
```

The original project's demo assets work directly (both served with permissive CORS):

- Video: `https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_video.mp4`
- JSON: `https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_json.json`

See the **Viewer › DemoRemote** story, which fetches both live.

## Data format

The parser expects the **snake_case** REST / `gcloud` shape — a top-level `annotation_results` array
with `shot_annotations`, `shot_label_annotations` / `segment_label_annotations`,
`person_detection_annotations`, `object_annotations`, `text_annotations`, and
`speech_transcriptions`. Time offsets are `{ seconds, nanos }` durations. Unknown feature keys are
ignored, so full API payloads validate. Generate your own with the
[`run_video_intelligence.py`](https://github.com/ZackAkil/video-intelligence-api-visualiser/blob/master/run_video_intelligence.py)
script from the original project.

## Future improvements

Not yet implemented (the demo JSON already carries data for all of them, so they can be added on the
existing canvas-overlay / panel pattern):

- **Face detection** (`face_detection_annotations`) — a possible future improvement; deferred for
  now.
- **Logo recognition** (`logo_recognition_annotations`).
- **Explicit content detection** (`explicit_annotation`).

## Development

```bash
pnpm --filter @snailicid3/video-intelligence-viewer dev:storybook
```

Open the **Viewer › WithSampleData** story to see it working with the bundled synthetic sample.
