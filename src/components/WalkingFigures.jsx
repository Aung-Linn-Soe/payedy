const COMMON = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" };

function FigureA(props) {
  return (
    <svg viewBox="0 0 60 140" width="60" height="140" {...COMMON} {...props}>
      <circle cx="30" cy="16" r="10" />
      <path d="M30 26 L30 76" />
      <path d="M30 40 L12 56" />
      <path d="M30 40 L47 30" />
      <path d="M30 76 L16 130" />
      <path d="M30 76 L44 126" />
    </svg>
  );
}

function FigureB(props) {
  return (
    <svg viewBox="0 0 60 140" width="60" height="140" {...COMMON} {...props}>
      <circle cx="30" cy="16" r="10" />
      <path d="M30 26 L30 76" />
      <path d="M30 38 L14 30" />
      <path d="M30 42 L46 58" />
      <rect x="42" y="52" width="14" height="18" rx="3" />
      <path d="M30 76 L44 130" />
      <path d="M30 76 L18 124" />
    </svg>
  );
}

function FigureC(props) {
  return (
    <svg viewBox="0 0 60 140" width="60" height="140" {...COMMON} {...props}>
      <circle cx="30" cy="16" r="10" />
      <path d="M30 26 L30 76" />
      <path d="M30 44 L20 48 L30 52 L40 48 Z" />
      <path d="M30 76 L14 122" />
      <path d="M30 76 L40 132" />
    </svg>
  );
}

function FigureD(props) {
  return (
    <svg viewBox="0 0 60 140" width="60" height="140" {...COMMON} {...props}>
      <circle cx="30" cy="16" r="10" />
      <path d="M30 26 L30 76" />
      <path d="M30 38 L46 20" />
      <path d="M30 40 L14 54" />
      <path d="M30 76 L42 128" />
      <path d="M30 76 L20 122" />
    </svg>
  );
}

export const FIGURES = [FigureA, FigureB, FigureC, FigureD];
