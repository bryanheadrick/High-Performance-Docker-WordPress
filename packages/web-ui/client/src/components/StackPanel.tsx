import type { ContainerStatus } from "../api";

interface Props {
  containers: ContainerStatus[];
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  busy: boolean;
}

export function StackPanel({ containers, onStart, onStop, onRestart, busy }: Props) {
  return (
    <div className="stack-panel">
      <h3>Docker Stack</h3>
      <div className="stack-controls">
        <button disabled={busy} onClick={onStart}>
          Start
        </button>
        <button disabled={busy} onClick={onStop}>
          Stop
        </button>
        <button disabled={busy} onClick={onRestart}>
          Restart
        </button>
      </div>
      <ul>
        {containers.map((container) => (
          <li key={container.name}>
            {container.name}: {container.state} ({container.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
