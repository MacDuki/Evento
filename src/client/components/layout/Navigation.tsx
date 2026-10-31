import { navItems } from "../../constants/app.js";
import type { View } from "../../types.js";
export function Navigation({ view, setView }: { view: View; setView: (view: View) => void }) {
  return <nav className="navigation" aria-label="Secciones principales">
    {navItems.map(item => {
      const Icon = item.icon;
      return <button key={item.id} type="button" aria-label={item.ariaLabel} className={view === item.id ? "selected" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}>
        <Icon aria-hidden="true" /><span className="nav-label">{item.label}</span>
      </button>;
    })}
  </nav>;
}

