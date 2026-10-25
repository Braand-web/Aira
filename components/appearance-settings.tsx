"use client";

import {useSyncExternalStore} from "react";
import {Check, Monitor, Moon, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import {ACCENT_THEMES} from "@/lib/appearance";
import {useAppearance} from "@/components/appearance-provider";
import {BraandAvatar} from "@/components/braand-avatar";

const modes = [
  {id: "light", label: "Clair", icon: Sun},
  {id: "dark", label: "Sombre", icon: Moon},
  {id: "system", label: "Système", icon: Monitor},
] as const;
const subscribeHydration = () => () => {};

export function AppearanceSettings() {
  const {theme, setTheme} = useTheme();
  const {accent, setAccent} = useAppearance();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const currentMode = hydrated ? theme ?? "system" : "system";

  return <section className="settings-section appearance-section" aria-labelledby="settings-appearance-title">
    <h4 id="settings-appearance-title">Apparence</h4>
    <div className="settings-card appearance-card">
      <div className="appearance-row">
        <span id="appearance-mode-label">Mode</span>
        <div className="appearance-modes" role="radiogroup" aria-labelledby="appearance-mode-label">
          {modes.map(({id, label, icon: Icon}) => <label key={id} className="appearance-mode" data-tooltip={label}>
            <input className="appearance-input" type="radio" name="braand-color-mode" value={id} checked={currentMode === id} onChange={() => setTheme(id)} aria-label={label}/>
            <span className="appearance-mode-face" aria-hidden="true"><Icon size={18} strokeWidth={1.6}/></span>
          </label>)}
        </div>
      </div>
      <div className="appearance-row appearance-colors-row">
        <span id="appearance-accent-label">Couleur du thème</span>
        <div className="appearance-colors" role="radiogroup" aria-labelledby="appearance-accent-label">
          {ACCENT_THEMES.map(({id, label}) => <label key={id} className="appearance-color" data-color={id} data-tooltip={label}>
            <input className="appearance-input" type="radio" name="braand-accent" value={id} checked={accent === id} onChange={() => setAccent(id)} aria-label={label}/>
            <span className="appearance-swatch" aria-hidden="true">
              {id === "default" && <BraandAvatar size={24} paused/>}
              {accent === id && <span className="appearance-selected"><Check size={10} strokeWidth={2.5}/></span>}
            </span>
          </label>)}
        </div>
      </div>
    </div>
    <p className="settings-service-note">Vos préférences sont enregistrées sur cet appareil.</p>
  </section>;
}
