interface TopBarProps {
  signedIn: boolean;
  displayName: string;
  canUseAuth: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function TopBar({ signedIn, displayName, canUseAuth, onSignIn, onSignOut }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <h1>Blindfold Chess Trainer</h1>
        <p className="muted">Minimal distraction drills: Square Color and static Lichess Puzzle Recall.</p>
      </div>
      <div className="top-actions">
        <span className="pill">{signedIn ? `Signed in as ${displayName}` : "Guest mode"}</span>
        {signedIn ? (
          <button type="button" className="btn secondary" onClick={onSignOut}>
            Sign out
          </button>
        ) : (
          <button type="button" className="btn secondary" disabled={!canUseAuth} onClick={onSignIn}>
            Sign in with GitHub
          </button>
        )}
      </div>
    </header>
  );
}
