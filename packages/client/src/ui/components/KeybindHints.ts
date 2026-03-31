/**
 * First-login keybind hints overlay.
 * Shows once per player, then never again (stored in localStorage).
 */

const STORAGE_KEY = "madworld_hints_seen";

export class KeybindHints {
  private el: HTMLElement | null = null;

  show(): void {
    // Don't show if already seen
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch { /* ignore */ }

    this.el = document.createElement("div");
    this.el.id = "keybind-hints";
    this.el.innerHTML = `
      <div class="hints-title">Welcome to MadWorld</div>
      <div class="hints-grid">
        <div class="hint-item"><span class="hint-key">WASD</span><span class="hint-label">Move around</span></div>
        <div class="hint-item"><span class="hint-key">Click</span><span class="hint-label">Attack / Interact</span></div>
        <div class="hint-item"><span class="hint-key">I</span><span class="hint-label">Inventory</span></div>
        <div class="hint-item"><span class="hint-key">K</span><span class="hint-label">Skills</span></div>
        <div class="hint-item"><span class="hint-key">Q</span><span class="hint-label">Quest Log</span></div>
        <div class="hint-item"><span class="hint-key">M</span><span class="hint-label">World Map</span></div>
        <div class="hint-item"><span class="hint-key">Enter</span><span class="hint-label">Chat</span></div>
        <div class="hint-item"><span class="hint-key">1-8</span><span class="hint-label">Use Abilities</span></div>
      </div>
      <div class="hints-dismiss">Click anywhere or press any key to start</div>
    `;

    document.getElementById("ui-root")?.appendChild(this.el);
    requestAnimationFrame(() => this.el?.classList.add("visible"));

    // Dismiss on click or keypress
    const dismiss = () => {
      if (!this.el) return;
      this.el.classList.remove("visible");
      setTimeout(() => {
        this.el?.remove();
        this.el = null;
      }, 400);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
      document.removeEventListener("keydown", dismiss);
    };

    this.el.addEventListener("click", dismiss);
    document.addEventListener("keydown", dismiss);
  }
}
