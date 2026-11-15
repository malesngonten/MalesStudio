/**
 * Males Ngonten Studio - Remotion Entry Point
 * Registered by @remotion/bundler for server-side rendering.
 * The ShortVideoComposition receives timeline data via inputProps.
 */

import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ShortVideoComposition } from './remotion/ShortVideoComposition';
import { INITIAL_STUDIO_TIMELINE } from './state/initialTimeline';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="short-video"
        component={ShortVideoComposition as any}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ timeline: INITIAL_STUDIO_TIMELINE }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
