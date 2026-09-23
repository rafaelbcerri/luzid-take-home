/**
 * Small inline icon set. Inline SVG keeps the bundle free of an icon library
 * for the handful of glyphs this app needs.
 */
type IconProps = { className?: string };

const BASE_ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function UploadIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 .8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </svg>
  );
}

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M12 9v4m0 3h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function FilmIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 12h18" />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-4.5 4 3.5 3-2.5 4 3.5" />
    </svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M12 6.01V6M12 12.01V12M12 18.01V18" strokeWidth={2.5} />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
    </svg>
  );
}

export function GripIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path
        d="M9 6.01V6M9 12.01V12M9 18.01V18M15 6.01V6M15 12.01V12M15 18.01V18"
        strokeWidth={2.5}
      />
    </svg>
  );
}

export function FrameIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M9 5v14" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ExpandIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
    </svg>
  );
}
