import { Easing, Interactive, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, type InteractiveBaseProps, type InteractiveTransformProps, type InteractivitySchema, type SequenceControls } from "remotion";
import { evolvePath } from "@remotion/paths";
import { forwardRef, useImperativeHandle, useRef, type ComponentProps } from "react";

interface IconAnimationProps {
  animation?: "draw" | "action" | "both";
  loop?: boolean;
  speed?: number;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

interface IconTimings {
  drawDurationInFrames?: number;
  actionDelayInFrames?: number;
  actionDurationInFrames?: number;
  loop?: boolean;
}

interface IconTimeline {
  drawProgress: number;
  scaleIn: number;
  actionFrame: number;
  actionProgress: number;
  cycleIndex: number;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function iconTimeline(
  frame: number,
  fps: number,
  props: IconAnimationProps,
  timings: IconTimings,
): IconTimeline {
  const animation = props.animation ?? "both";
  const loop = props.loop ?? timings.loop ?? false;
  const drawDuration = timings.drawDurationInFrames ?? 14;
  const actionDelay = timings.actionDelayInFrames ?? 2;
  const actionDuration = timings.actionDurationInFrames ?? 20;

  const drawProgress =
    animation === "action"
      ? 1
      : easeOut(clamp01(drawDuration > 0 ? frame / drawDuration : 1));

  const scaleIn = clamp01(
    spring({
      frame,
      fps,
      config: { damping: 18, stiffness: 220, mass: 0.7 },
      durationInFrames: Math.max(1, drawDuration),
    }),
  );

  const actionStart = animation === "action" ? 0 : drawDuration + actionDelay;
  const sinceStart = frame - actionStart;

  if (animation === "draw" || sinceStart < 0) {
    return {
      drawProgress,
      scaleIn,
      actionFrame: sinceStart,
      actionProgress: 0,
      cycleIndex: 0,
    };
  }

  if (actionDuration <= 0) {
    return {
      drawProgress,
      scaleIn,
      actionFrame: sinceStart,
      actionProgress: 1,
      cycleIndex: 0,
    };
  }

  if (loop) {
    const cycleIndex = Math.floor(sinceStart / actionDuration);
    const local = sinceStart - cycleIndex * actionDuration;
    return {
      drawProgress,
      scaleIn,
      actionFrame: local,
      actionProgress: local / actionDuration,
      cycleIndex,
    };
  }

  return {
    drawProgress,
    scaleIn,
    actionFrame: sinceStart,
    actionProgress: clamp01(sinceStart / actionDuration),
    cycleIndex: 0,
  };
}

function useIconAnimation(
  props: IconAnimationProps,
  timings: IconTimings,
): IconTimeline {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const speed = props.speed ?? 1;
  return iconTimeline(frame * speed, fps, props, timings);
}

function staggeredProgress(
  progress: number,
  index: number,
  count: number,
  overlap = 0.5,
): number {
  if (count <= 1) return clamp01(progress);
  const o = clamp01(overlap);
  const width = 1 / (count - (count - 1) * o);
  const start = index * width * (1 - o);
  return clamp01((progress - start) / width);
}

function drawnPathProps(
  d: string,
  progress: number,
): { strokeDasharray: string; strokeDashoffset: number } {
  return evolvePath(clamp01(progress), d);
}

const ARC_PATH = "M21 12a9 9 0 1 1-6.219-8.56";

const TIMINGS = {
  drawDurationInFrames: 10,
  actionDelayInFrames: 2,
  actionDurationInFrames: 40,
  loop: true,
} as const;

function LoaderIconBase({
  animation = "both",
  loop,
  speed,
  size = 48,
  color = "currentColor",
  strokeWidth = 2,
  className,
}: IconAnimationProps) {
  const { drawProgress, actionProgress, cycleIndex } = useIconAnimation(
    { animation, loop, speed },
    TIMINGS,
  );

  const linearDraw = 1 - (1 - drawProgress) ** (1 / 3);

  const arcProgress = interpolate(linearDraw, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const entrance = interpolate(linearDraw, [0, 1], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const arc = drawnPathProps(ARC_PATH, arcProgress);
  const rotate = (cycleIndex + actionProgress) * 360;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        overflow: "visible",
        transformOrigin: "center",
        transform: `rotate(${rotate}deg) scale(${entrance})`,
      }}
    >
      <path
        d={ARC_PATH}
        strokeDasharray={arc.strokeDasharray}
        strokeDashoffset={arc.strokeDashoffset}
      />
    </svg>
  );
}

function LoaderIconStatic({
  size = 48,
  color = "currentColor",
  strokeWidth = 2,
  className,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ARC_PATH} />
    </svg>
  );
}

const elementSchema = {
  ...Interactive.baseSchema,
  animation: {
    type: "enum",
    default: "both",
    variants: {
      draw: {},
      action: {},
      both: {},
    },
    description: "Animation",
  },
  loop: {
    type: "boolean",
    default: true,
    description: "Loop",
  },
  size: {
    type: "number",
    min: 24,
    max: 200,
    step: 4,
    default: 48,
    description: "Size",
    hiddenFromList: false,
  },
  color: {
    type: "color",
    default: "#171717",
    description: "Color",
  },
  strokeWidth: {
    type: "number",
    min: 1,
    max: 3,
    step: 0.25,
    default: 2,
    description: "Stroke width",
    hiddenFromList: false,
  },
  speed: {
    type: "number",
    default: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    description: "Speed",
    hiddenFromList: false,
  },
  width: {
    type: "number",
    default: 48,
    min: 10,
    step: 10,
    description: "Width",
  },
  height: {
    type: "number",
    default: 48,
    min: 10,
    step: 10,
    description: "Height",
  },
  ...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

const ELEMENT_PROP_KEYS = new Set(["animation","loop","size","color","strokeWidth","speed"]);

const ELEMENT_PROP_DEFAULTS: Record<string, unknown> = {
  animation: "both",
  loop: true,
  size: 48,
  color: "#171717",
  strokeWidth: 2,
  speed: 1,
};

type LoaderIconElementProps = InteractiveBaseProps &
  InteractiveTransformProps & { readonly width?: number; readonly height?: number } &
  ComponentProps<typeof LoaderIconBase>;

const LoaderIconInner = forwardRef<
  HTMLDivElement,
  LoaderIconElementProps & { readonly controls: SequenceControls | undefined }
>(({ controls, name, style, width = 48, height = 48, ...rest }, ref) => {
  const outlineRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
  const componentProps: Record<string, unknown> = { ...ELEMENT_PROP_DEFAULTS };
  const sequenceProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (ELEMENT_PROP_KEYS.has(key)) {
      if (value !== undefined) componentProps[key] = value;
    } else {
      sequenceProps[key] = value;
    }
  }
  return (
    <Sequence
      layout="none"
      {...sequenceProps}
      controls={controls}
      name={name ?? "<LoaderIcon>"}
      outlineRef={outlineRef}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={outlineRef}
          style={{
            position: "relative",
            width,
            height,
            ...style,
          }}
        >
          <LoaderIconBase
            {...(componentProps as unknown as ComponentProps<typeof LoaderIconBase>)}
          />
        </div>
      </div>
    </Sequence>
  );
});

export const LoaderIcon = Interactive.withSchema({
  Component: LoaderIconInner,
  componentName: "<LoaderIcon>",
  componentIdentity: null,
  schema: elementSchema,
  supportsEffects: false,
});
