"use client";

import { useState } from "react";
import { VideoPlayer } from "./video-player";
import { MediaViewer, type ViewerSelection } from "./media-viewer";

/** A single-file admin preview with the same playback handoff as gig galleries. */
export function VideoPreview({
  src,
  label,
  download,
}: {
  src: string;
  label: string;
  download: string;
}) {
  const [selection, setSelection] = useState<ViewerSelection | null>(null);
  return (
    <div className="w-full min-w-0">
      <VideoPlayer
        src={src}
        label={label}
        suspended={selection !== null}
        onExpand={(playback) => setSelection({ index: 0, playback })}
      />
      <MediaViewer
        media={[{ id: src, type: "video", src, alt: label, download }]}
        selection={selection}
        onSelectionChange={setSelection}
      />
    </div>
  );
}
