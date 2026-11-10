"use client";

import { AbsoluteFill } from "remotion";

const SANS =
  "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif";
const MONO =
  "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const INK = "#f2f2f2";
const MUTED = "#8b8f9a";
const MINT = "#a1eebd";
const PEACH = "#ffb38e";
const LAVENDER = "#d4b3ff";

const BARS = [0.32, 0.51, 0.43, 0.68, 0.57, 0.86, 0.64, 1];

const JOBS = [
  { file: "intro-scene.mp4", state: "Done", tone: MINT },
  { file: "feature-tour.mp4", state: "Rendering", tone: PEACH },
  { file: "pricing-outro.mp4", state: "Queued", tone: LAVENDER },
];

export function CanvasSceneA() {
  return (
    <AbsoluteFill
      style={{
        background: "#0a0a0a",
        padding: 96,
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <span style={{ fontSize: 34, color: MUTED }}>Deploys this week</span>
      <span
        style={{
          marginTop: 6,
          fontSize: 152,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: INK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        2,481
      </span>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-end",
          height: 190,
          marginTop: 52,
        }}
      >
        {BARS.map((height, index) => (
          <div
            key={height}
            style={{
              width: 74,
              height: `${height * 100}%`,
              borderRadius: 10,
              background: index === BARS.length - 1 ? MINT : "#23262e",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

const POSTER_BARS = [
  { tone: "#1f7a72", width: 0.92 },
  { tone: "#e2673a", width: 0.68 },
  { tone: "#2c3f8f", width: 0.44 },
];

export function CanvasScenePoster() {
  return (
    <AbsoluteFill
      style={{
        background: "#efe9dc",
        padding: 96,
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <span
        style={{
          fontSize: 30,
          fontWeight: 500,
          color: "#8a7f6b",
        }}
      >
        Issue 04
      </span>
      <span
        style={{
          marginTop: 18,
          maxWidth: 760,
          fontSize: 92,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.02,
          color: "#171410",
        }}
      >
        Ship the demo, not the deck
      </span>
      <span
        style={{
          marginTop: 28,
          maxWidth: 640,
          fontSize: 32,
          lineHeight: 1.4,
          color: "#5c5346",
        }}
      >
        A recorded product beats a rehearsed one. Cut it in the afternoon and
        send it before the meeting.
      </span>
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column" }}>
        {POSTER_BARS.map((bar) => (
          <div
            key={bar.tone}
            style={{
              width: `${bar.width * 100}%`,
              height: 26,
              marginBottom: 14,
              background: bar.tone,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

export const SECRET_ROW_X = 504;
export const SECRET_ROW_WIDTH = 600;
export const SECRET_ROW_HEIGHT = 72;

const SECRET_ROWS = [
  { label: "Account", value: "casey@example.com", y: 220 },
  { label: "API key", value: "sk_live_4f8a2c9e1b7d", y: 332 },
  { label: "Webhook secret", value: "whsec_71c0d4e8ab35", y: 444 },
];

export function CanvasSceneSecrets() {
  return (
    <AbsoluteFill style={{ background: "#0d0f14", fontFamily: SANS }}>
      <span
        style={{
          position: "absolute",
          left: 96,
          top: 104,
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: INK,
        }}
      >
        Project credentials
      </span>
      {SECRET_ROWS.map((row) => (
        <div key={row.label}>
          <div
            style={{
              position: "absolute",
              left: 96,
              top: row.y,
              height: SECRET_ROW_HEIGHT,
              display: "flex",
              alignItems: "center",
              fontSize: 34,
              color: MUTED,
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              position: "absolute",
              left: SECRET_ROW_X,
              top: row.y,
              width: SECRET_ROW_WIDTH,
              height: SECRET_ROW_HEIGHT,
              display: "flex",
              alignItems: "center",
              fontFamily: MONO,
              fontSize: 34,
              color: INK,
            }}
          >
            {row.value}
          </div>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 568,
          paddingTop: 28,
          borderTop: "1px solid #1e222c",
          fontSize: 28,
          color: MUTED,
        }}
      >
        Rotate keys from the dashboard — old ones stay valid for 24 hours.
      </div>
    </AbsoluteFill>
  );
}

export function CanvasSceneB() {
  return (
    <AbsoluteFill
      style={{
        background: "#101828",
        padding: 96,
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <span style={{ fontSize: 34, color: MUTED }}>Render queue</span>
      <div style={{ marginTop: 34 }}>
        {JOBS.map((job) => (
          <div
            key={job.file}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "30px 0",
              borderTop: "1px solid #23304a",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 44, color: INK }}>
              {job.file}
            </span>
            <span
              style={{
                padding: "12px 26px",
                borderRadius: 999,
                fontSize: 30,
                fontWeight: 500,
                color: "#101828",
                background: job.tone,
              }}
            >
              {job.state}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
