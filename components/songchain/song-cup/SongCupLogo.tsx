export function SongCupLogo() {
  return (
    <div className="logo-container">
      <div className="top-row text-glow">
        <span className="letter-s">s</span>
        <div className="ball-container" aria-hidden="true">
          <svg className="soccer-ball" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="ballGradient" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="75%" stopColor="#e8e8e8" />
                <stop offset="100%" stopColor="#a0a0a0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#ballGradient)" stroke="#333" strokeWidth="1.5" />
            <polygon
              points="50,30 69,44 62,66 38,66 31,44"
              className="ball-patch"
              fill="#3d4a5c"
              stroke="#3d4a5c"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line x1="50" y1="30" x2="50" y2="10" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="69" y1="44" x2="88" y2="38" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="62" y1="66" x2="74" y2="82" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="38" y1="66" x2="26" y2="82" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="31" y1="44" x2="12" y2="38" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <path
              d="M 50 10 L 36 4 A 48 48 0 0 1 64 4 Z"
              className="ball-patch"
              fill="#3d4a5c"
              stroke="#3d4a5c"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M 88 38 L 89 22 A 48 48 0 0 1 98 50 Z"
              className="ball-patch"
              fill="#3d4a5c"
              stroke="#3d4a5c"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M 74 82 L 89 78 A 48 48 0 0 1 65 96 Z"
              className="ball-patch"
              fill="#3d4a5c"
              stroke="#3d4a5c"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M 26 82 L 35 96 A 48 48 0 0 1 11 78 Z"
              className="ball-patch"
              fill="#3d4a5c"
              stroke="#3d4a5c"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M 12 38 L 2 50 A 48 48 0 0 1 11 22 Z"
              className="ball-patch"
              fill="#3d4a5c"
              stroke="#3d4a5c"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <line x1="50" y1="10" x2="36" y2="4" stroke="#333" strokeWidth="1.5" />
            <line x1="50" y1="10" x2="64" y2="4" stroke="#333" strokeWidth="1.5" />
            <line x1="88" y1="38" x2="89" y2="22" stroke="#333" strokeWidth="1.5" />
            <line x1="88" y1="38" x2="98" y2="50" stroke="#333" strokeWidth="1.5" />
            <line x1="74" y1="82" x2="89" y2="78" stroke="#333" strokeWidth="1.5" />
            <line x1="74" y1="82" x2="65" y2="96" stroke="#333" strokeWidth="1.5" />
            <line x1="26" y1="82" x2="35" y2="96" stroke="#333" strokeWidth="1.5" />
            <line x1="26" y1="82" x2="11" y2="78" stroke="#333" strokeWidth="1.5" />
            <line x1="12" y1="38" x2="2" y2="50" stroke="#333" strokeWidth="1.5" />
            <line x1="12" y1="38" x2="11" y2="22" stroke="#333" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          </svg>
          <div className="ball-shadow" />
        </div>
        <span className="letter-n">N</span>
        <span className="letter-g">g</span>
        <span className="word-cup">CUP</span>
      </div>
      <div className="bottom-row text-glow">
        <span>C</span>
        <span>L</span>
        <span>U</span>
        <span>B</span>
      </div>
    </div>
  );
}
