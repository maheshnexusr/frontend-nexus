import { Menu } from "lucide-react";
import styles from "./Header.module.css";
import ThemeToggle from "./ThemeToggle";

export default function Header({ theme, setTheme, onMobileMenuToggle }) {
  return (
    <header className={styles.header}>
      {/* Hamburger — visible on mobile only (<768 px) */}
      <button
        onClick={onMobileMenuToggle}
        aria-label="Toggle sidebar"
        className={styles.hamburger}
      >
        <Menu size={18} />
      </button>

      <div className={styles.spacer} />

      {/* Theme toggle — only control in the header */}
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </header>
  );
}
