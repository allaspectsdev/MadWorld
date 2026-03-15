export class LoadingScreen {
  private container: HTMLElement;
  private progressBar: HTMLElement;
  private statusText: HTMLElement;

  constructor() {
    this.container = document.getElementById("loading-screen")!;
    this.progressBar = document.getElementById("loading-bar")!;
    this.statusText = document.getElementById("loading-status")!;
  }

  setProgress(pct: number, status: string): void {
    if (this.progressBar) {
      this.progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
    if (this.statusText) {
      this.statusText.textContent = status;
    }
  }

  hide(): void {
    if (this.container) {
      this.container.classList.add("hidden");
      // Remove from DOM after transition
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.style.display = "none";
        }
      }, 500);
    }
  }
}
