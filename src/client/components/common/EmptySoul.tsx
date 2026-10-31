import { Plus } from "lucide-react";
import type { Soul } from "../../types.js";

export function EmptySoulOrb({ dead = false }: { dead?: boolean }) {
  return <div className={`soul-orbit no-soul-orbit ${dead ? "is-dead" : ""}`} aria-hidden="true">
    <span className="soul-orb-loader">
      <svg width="100" height="100" viewBox="0 0 100 100" focusable="false">
        <defs>
          <mask id="clipping">
            <polygon points="0,0 100,0 100,100 0,100" fill="black" />
            <polygon points="25,25 75,25 50,75" fill="white" />
            <polygon points="50,25 75,75 25,75" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
          </mask>
        </defs>
      </svg>
      <span className="soul-orb-box" />
    </span>
  </div>;
}

export function NoSoul({ deadSoul, onCreate, onOpenMemory }: { deadSoul?: Soul | null; onCreate: () => void; onOpenMemory?: () => void }) {
  const dead = deadSoul?.status === "dead";
  return <section className={`no-soul-state ${dead ? "is-dead" : ""}`}>
    {dead ? <>
      <EmptySoulOrb dead />
      <div className="no-soul-copy">
        <span className="eyebrow">Memoria</span>
        <h2>{deadSoul.name}</h2>
        <p>Máxima pureza: <strong>{deadSoul.maxPurityDays} días</strong>. Su historia queda guardada.</p>
      </div>
    </> : <>
      <h2 className="sr-only">Sin soul</h2>
      <EmptySoulOrb />
    </>}
    <div className="no-soul-actions">
      {dead && onOpenMemory && <button className="quiet-button memory-link" type="button" onClick={onOpenMemory}>Ver memoria</button>}
      <button className="primary empty-primary" type="button" onClick={onCreate}><span>{dead ? "Nueva soul" : "Crear"}</span><Plus aria-hidden="true" /></button>
    </div>
  </section>;
}
