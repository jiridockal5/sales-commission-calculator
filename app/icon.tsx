import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2557e8",
          borderRadius: "6px",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
          <line x1="8" x2="16" y1="6" y2="6" />
          <line x1="8" x2="16" y1="10" y2="10" />
          <line x1="8" x2="16" y1="14" y2="14" />
          <line x1="8" x2="16" y1="18" y2="18" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
