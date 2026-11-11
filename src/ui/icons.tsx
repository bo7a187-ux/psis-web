/** Small inline icon set (stroke icons, 24-unit grid). Inline so the page needs no network access. */
const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  upload: 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  columns: 'M4 5h16v14H4zM9.33 5v14M14.67 5v14',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2 2 4-4',
  tag: 'M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5-8.5-8.5ZM8 8h.01',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
  check: 'M5 12.5 10 17.5 19.5 7',
  table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9',
  gauge: 'M4.5 17a8.5 8.5 0 1 1 15 0M12 13l4-4.5M12 13h.01',
  gantt: 'M4 4v16h16M7 7h6M10 11h7M8 15h5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 8v4l3 2',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  report: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  chevron: 'm9 6 6 6-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-4.5M12 8h.01',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4.5m0 2.5h.01',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mail: 'M3.5 5.5h17v13h-17zM3.5 6l8.5 7 8.5-7',
  linkedin: 'M4 9v11M4 4.5v.01M9 20v-6.5a3.5 3.5 0 0 1 7 0V20M9 9v11M20 20v-6',
  bars: 'M4 6.5h8M7 12h11M10 17.5h8M4 3v18',
  clipboard: 'M9 3.5h6v3H9zM7.5 5H5.5v16h13V5h-2M9 13.5l2 2 4-4.5',
  compare: 'M8 4v16M16 4v16M4 8l4-4 4 4M12 16l4 4 4-4',
  ahead: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 15h7m-2.5-2.5L15 15l-2.5 2.5',
  printer: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a3 3 0 0 1 3-3h7M18 9v6a3 3 0 0 1-3 3H8',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.3 3.3 0 0 1 0 6.3M18 14.8c1.9.7 3 2.5 3 5.2',
};
export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, stroke = 1.8 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

/** Brand mark: three schedule bars climbing to a milestone. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="#2f6bff" />
      <rect x="7" y="9" width="10" height="3.4" rx="1.7" fill="#fff" opacity=".55" />
      <rect x="11" y="15.3" width="11" height="3.4" rx="1.7" fill="#fff" opacity=".8" />
      <rect x="15" y="21.6" width="8" height="3.4" rx="1.7" fill="#fff" />
      <path d="m27 19.6 3 3.7-3 3.7-3-3.7z" fill="#ffb020" />
    </svg>
  );
}
