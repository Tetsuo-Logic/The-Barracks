// A wide course-horizon banner in the app's palette — sits across the top of
// the home screen so the illustration is seen every visit, not just at login.
export function GolfBanner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 120"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A golf course horizon"
    >
      {/* soft low sun */}
      <circle cx="404" cy="40" r="26" fill="var(--color-sand)" fillOpacity="0.35" />
      {/* far hills */}
      <path d="M0 78 Q120 54 240 70 T480 62 V120 H0 Z" fill="var(--color-moss)" fillOpacity="0.2" />
      {/* mid green */}
      <path d="M0 92 Q160 66 320 88 T480 82 V120 H0 Z" fill="var(--color-moss)" fillOpacity="0.42" />
      {/* front green */}
      <path d="M0 108 Q140 92 300 106 T480 104 V120 H0 Z" fill="var(--color-moss)" fillOpacity="0.62" />
      {/* hole + flag */}
      <ellipse cx="372" cy="96" rx="10" ry="3.2" fill="var(--color-ink)" />
      <rect x="371" y="42" width="2.4" height="54" rx="1" fill="var(--color-ink)" />
      <path d="M373.4 46 L402 56 L373.4 66 Z" fill="var(--color-flag)" />
      {/* ball */}
      <circle cx="120" cy="100" r="6" fill="var(--color-card)" stroke="var(--color-rule)" />
      {/* birds */}
      <path d="M60 30 q5 -5 10 0 q5 -5 10 0" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M92 22 q3.5 -3.5 7 0 q3.5 -3.5 7 0" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// A small hand-drawn golf vignette in the app's palette — flag on a green with
// a ball. Used to warm up the login and empty states without external images.
export function GolfScene({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 150"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A flag on a putting green"
    >
      {/* rolling greens */}
      <path
        d="M0 108 Q60 82 128 100 T240 92 V150 H0 Z"
        fill="var(--color-moss)"
        fillOpacity="0.22"
      />
      <path
        d="M0 128 Q84 104 168 124 T240 120 V150 H0 Z"
        fill="var(--color-moss)"
        fillOpacity="0.5"
      />
      {/* hole */}
      <ellipse cx="156" cy="120" rx="11" ry="3.6" fill="var(--color-ink)" />
      {/* pole */}
      <rect x="155" y="58" width="2.5" height="62" rx="1" fill="var(--color-ink)" />
      {/* flag */}
      <path d="M157.5 62 L190 73 L157.5 84 Z" fill="var(--color-flag)" />
      {/* ball with a soft dimple shadow */}
      <ellipse cx="68" cy="132" rx="8" ry="2.6" fill="var(--color-ink)" fillOpacity="0.12" />
      <circle cx="68" cy="126" r="7" fill="var(--color-card)" stroke="var(--color-rule)" />
      {/* a couple of birds, hairline */}
      <path d="M40 40 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M70 30 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
