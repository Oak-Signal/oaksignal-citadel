import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site-content";

// Sharing preview for every public page (FR-026). Generated once at build time.

export const alt = `${site.name}: ${site.valueStatement}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand colours as hex: ImageResponse does not understand the oklch tokens in globals.css.
const NAVY = "#1b2f5c";
const NAVY_DEEP = "#13213f";
const SIGNAL = "#5fa3b1";

const logo = await readFile(join(process.cwd(), "public", "citadel-logo.svg"), "base64");

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "white",
        background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={`data:image/svg+xml;base64,${logo}`} width={88} height={88} />
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 16 }}>{site.name}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
          {site.valueStatement}
        </div>
        <div style={{ fontSize: 28, opacity: 0.85, maxWidth: 960 }}>{site.expansion}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24 }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: SIGNAL }} />
        <div style={{ opacity: 0.85 }}>Built by OakSignal · Free for cadet units</div>
      </div>
    </div>,
    { ...size },
  );
}
