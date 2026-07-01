import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2">
          <svg
            width={22}
            height={22}
            viewBox="0 0 96 96"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="vlogo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#6ee7b7" />
                <stop offset="1" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <rect width="96" height="96" rx="22" fill="#0a0f0d" />
            <path d="M26 24 L40 24 L52 66 L44 72 Z" fill="url(#vlogo)" />
            <path
              d="M70 24 L56 24 L44 66 L52 72 Z"
              fill="url(#vlogo)"
              opacity="0.9"
            />
          </svg>
          <span className="font-semibold">Vision</span>
        </span>
      ),
    },
    // Dark theme only — hide the light/dark toggle
    themeSwitch: {
      enabled: false,
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
      {
        text: "GitHub",
        url: "https://github.com/ephor/vision",
        external: true,
      },
    ],
    githubUrl: "https://github.com/ephor/vision",
  };
}
