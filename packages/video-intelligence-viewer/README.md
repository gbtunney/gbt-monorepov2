# @snailicid3/video-intelligence-viewer

React components for visualising
[Google Cloud Video Intelligence API](https://cloud.google.com/video-intelligence) annotations — a
React port of Zack Akil's
[video-intelligence-api-visualiser](https://github.com/ZackAkil/video-intelligence-api-visualiser).

First pass covers three features: **Shot detection**, **Label detection**, and **Person detection**
(bounding boxes + landmarks drawn on a canvas overlay, interpolated between sampled frames).

## Usage

```tsx
import { VideoIntelligenceViewer } from '@snailicid3/video-intelligence-viewer'

export const App = () => <VideoIntelligenceViewer />
```

Everything runs client-side:

- **Load video** — pick a local video file (kept in-browser via an object URL; nothing is uploaded).
- **Load annotations (JSON)** — pick a Video Intelligence API output file; it's parsed and validated
  in the browser.

You can also seed data up front:

```tsx
import { parseAnnotations, VideoIntelligenceViewer } from '@snailicid3/video-intelligence-viewer'

const annotations = parseAnnotations(rawJsonString)

;<VideoIntelligenceViewer
  defaultThreshold={0.5}
  initialAnnotations={annotations}
  videoSrc="/clip.mp4"
/>
```

## Data format

The parser expects the **snake_case** REST / `gcloud` shape — a top-level `annotation_results` array
with `shot_annotations`, `shot_label_annotations` / `segment_label_annotations`, and
`person_detection_annotations`. Time offsets are `{ seconds, nanos }` durations. Generate your own
with the
[`run_video_intelligence.py`](https://github.com/ZackAkil/video-intelligence-api-visualiser/blob/master/run_video_intelligence.py)
script from the original project.

## Development

```bash
pnpm --filter @snailicid3/video-intelligence-viewer dev:storybook
```

Open the **Viewer › WithSampleData** story to see it working with the bundled synthetic sample.
