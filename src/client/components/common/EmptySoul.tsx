import { Plus } from "lucide-react";
export function EmptySoulOrb() {
  return <div className="soul-orbit no-soul-orbit" aria-hidden="true">
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

export function NoSoul({ onCreate }: { onCreate: () => void }) {
  return <section className="no-soul-state">
    <h2 className="sr-only">Sin ciclo activo</h2>
    <EmptySoulOrb />
    <button className="primary empty-primary" type="button" onClick={onCreate}><span>Crear</span><Plus aria-hidden="true" /></button>
  </section>;
}

