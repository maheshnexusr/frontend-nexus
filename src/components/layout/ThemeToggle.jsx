import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import styles from "./ThemeToggle.module.css";

const clx = (...a) => a.filter(Boolean).join(" ");

const THEME_KEY = "app-theme-preference";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem(THEME_KEY) || "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}

const options = [
  { value: "light",  label: "Light",  icon: Sun     },
  { value: "dark",   label: "Dark",   icon: Moon    },
  { value: "system", label: "System", icon: Monitor },
];

export default function ThemeToggle({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current     = options.find((o) => o.value === theme);
  const CurrentIcon = current?.icon || Monitor;

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={styles.toggleBtn}
        aria-label="Toggle theme"
      >
        <CurrentIcon size={18} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); setOpen(false); }}
                className={clx(styles.option, theme === opt.value && styles.active)}
              >
                <Icon size={16} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
