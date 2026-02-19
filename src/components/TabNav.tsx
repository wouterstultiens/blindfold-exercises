import type { AppTab } from "../types";

interface TabNavProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

export function TabNav({ activeTab, onChange }: TabNavProps) {
  return (
    <nav className="tabbar" aria-label="App sections">
      <button
        type="button"
        className={`tab-btn ${activeTab === "training" ? "active" : ""}`}
        data-testid="training-tab"
        onClick={() => onChange("training")}
      >
        Training
      </button>
      <button
        type="button"
        className={`tab-btn ${activeTab === "progress" ? "active" : ""}`}
        data-testid="progress-tab"
        onClick={() => onChange("progress")}
      >
        Progress
      </button>
    </nav>
  );
}
