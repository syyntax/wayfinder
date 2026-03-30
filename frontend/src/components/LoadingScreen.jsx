import './LoadingScreen.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <svg viewBox="0 0 100 100" className="logo-svg">
            <defs>
              <linearGradient id="loadingGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b3daf" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="35" fill="none" stroke="url(#loadingGlow)" strokeWidth="2" className="outer-ring" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="url(#loadingGlow)" strokeWidth="1.5" strokeDasharray="4 2" className="inner-ring" />
            <path d="M50 15 L55 30 L50 25 L45 30 Z" fill="url(#loadingGlow)" />
            <path d="M50 85 L45 70 L50 75 L55 70 Z" fill="url(#loadingGlow)" />
            <path d="M15 50 L30 45 L25 50 L30 55 Z" fill="url(#loadingGlow)" />
            <path d="M85 50 L70 55 L75 50 L70 45 Z" fill="url(#loadingGlow)" />
            <circle cx="50" cy="50" r="8" fill="url(#loadingGlow)" className="center-dot" />
            <circle cx="50" cy="50" r="4" fill="#0a0a0f" />
          </svg>
        </div>
        <h1 className="loading-title">WAYFINDER</h1>
        <p className="loading-subtitle">Initializing Command Interface...</p>
        <div className="loading-bar">
          <div className="loading-progress"></div>
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
