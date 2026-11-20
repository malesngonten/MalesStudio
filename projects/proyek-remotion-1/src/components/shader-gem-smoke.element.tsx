import { GemSmoke, type GemSmokeProps } from "@paper-design/shaders-react";
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, type ComponentProps } from "react";
import { Interactive, Sequence, continueRender, delayRender, useCurrentFrame, useVideoConfig, type InteractiveBaseProps, type InteractiveTransformProps, type InteractivitySchema, type SequenceControls } from "remotion";

const NEUTRAL_COLORS = ["#3a3a5c", "#52527a"];

interface ShaderGemSmokeProps
  extends Omit<GemSmokeProps, "frame" | "ref"> {}

/**
 * Paper's Gem Smoke shader, driven deterministically by the current frame.
 *
 * Animated color fields placed over a logo shape — smoke lives behind (and
 * inside) the glassy silhouette. Feed it a brand mark via `image` (a URL,
 * e.g. staticFile('prisma/symbol-light.svg')); the shape is processed once
 * and cached, so every frame renders the same smoke at the same time.
 */
function ShaderGemSmokeBase({
  speed = 1,
  colors = NEUTRAL_COLORS,
  colorBack = "#0a0a10",
  innerDistortion = 0.8,
  outerDistortion = 0.6,
  outerGlow = 0.55,
  innerGlow = 1,
  size = 0.8,
  className,
  ...rest
}: ShaderGemSmokeProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const [handle] = useState(() => delayRender("shader-gem-smoke"));
  const gate = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => continueRender(handle)),
      );
    },
    [handle],
  );

  return (
    <div
      ref={gate}
      className={className}
      style={{ position: "absolute", inset: 0 }}
    >
      <React.Suspense fallback={null}>
        <GemSmoke
          speed={0}
          frame={(frame / fps) * speed * 1000}
          colors={colors}
          colorBack={colorBack}
          innerDistortion={innerDistortion}
          outerDistortion={outerDistortion}
          outerGlow={outerGlow}
          innerGlow={innerGlow}
          size={size}
          fit="cover"
          width={width}
          height={height}
          suspendWhenProcessingImage
          {...rest}
        />
      </React.Suspense>
    </div>
  );
}

const elementSchema = {
  ...Interactive.baseSchema,
  speed: {
    type: "number",
    default: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    description: "Speed",
    hiddenFromList: false,
  },
  colorBack: {
    type: "color",
    default: "#0a0a10",
    description: "Background",
  },
  innerDistortion: {
    type: "number",
    min: 0,
    max: 2,
    step: 0.05,
    default: 0.8,
    description: "Inner distortion",
    hiddenFromList: false,
  },
  outerDistortion: {
    type: "number",
    min: 0,
    max: 2,
    step: 0.05,
    default: 0.6,
    description: "Outer distortion",
    hiddenFromList: false,
  },
  size: {
    type: "number",
    min: 0.2,
    max: 1.5,
    step: 0.05,
    default: 0.8,
    description: "Size",
    hiddenFromList: false,
  },
  ...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

const ELEMENT_PROP_KEYS = new Set(["speed","colorBack","innerDistortion","outerDistortion","size"]);

const ELEMENT_PROP_DEFAULTS: Record<string, unknown> = {
  speed: 1,
  colorBack: "#0a0a10",
  innerDistortion: 0.8,
  outerDistortion: 0.6,
  size: 0.8,
};

type ShaderGemSmokeElementProps = InteractiveBaseProps &
  InteractiveTransformProps &
  ComponentProps<typeof ShaderGemSmokeBase>;

const ShaderGemSmokeInner = forwardRef<
  HTMLDivElement,
  ShaderGemSmokeElementProps & { readonly controls: SequenceControls | undefined }
>(({ controls, name, style, ...rest }, ref) => {
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
      name={name ?? "<ShaderGemSmoke>"}
      outlineRef={outlineRef}
    >
      <div
        ref={outlineRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <ShaderGemSmokeBase
          {...(componentProps as unknown as ComponentProps<typeof ShaderGemSmokeBase>)}
        />
      </div>
    </Sequence>
  );
});

export const ShaderGemSmoke = Interactive.withSchema({
  Component: ShaderGemSmokeInner,
  componentName: "<ShaderGemSmoke>",
  componentIdentity: null,
  schema: elementSchema,
  supportsEffects: false,
});
