import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
}

type Listener = () => void;

class ThemeStore {
  private theme: ThemeMode;
  private resolvedTheme: 'light' | 'dark';
  private listeners: Set<Listener> = new Set();
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('tracelens-theme') : null;
    this.theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    this.resolvedTheme = this.computeResolvedTheme(this.theme);

    if (typeof window !== 'undefined') {
      this.applyDomClass();

      if (window.matchMedia) {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.mediaListener = (e: MediaQueryListEvent) => {
          if (this.theme === 'system') {
            const newResolved = e.matches ? 'dark' : 'light';
            if (newResolved !== this.resolvedTheme) {
              this.resolvedTheme = newResolved;
              this.applyDomClass();
              this.notify();
            }
          }
        };
        this.mediaQuery.addEventListener('change', this.mediaListener);
      }
    }
  }

  private computeResolvedTheme(theme: ThemeMode): 'light' | 'dark' {
    if (theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'dark';
    }
    return theme;
  }

  private applyDomClass() {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (this.resolvedTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }

  getState(): ThemeState {
    return {
      theme: this.theme,
      resolvedTheme: this.resolvedTheme,
    };
  }

  setTheme(newTheme: ThemeMode) {
    if (this.theme === newTheme) return;
    this.theme = newTheme;
    try {
      localStorage.setItem('tracelens-theme', newTheme);
    } catch {
      // ignore
    }
    this.resolvedTheme = this.computeResolvedTheme(newTheme);
    this.applyDomClass();
    this.notify();
  }

  cycleTheme() {
    if (this.theme === 'dark') {
      this.setTheme('light');
    } else if (this.theme === 'light') {
      this.setTheme('system');
    } else {
      this.setTheme('dark');
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Theme listener error:', err);
      }
    });
  }
}

export const themeStore = new ThemeStore();

export function useTheme() {
  const [state, setState] = useState<ThemeState>(() => themeStore.getState());

  useEffect(() => {
    return themeStore.subscribe(() => {
      setState(themeStore.getState());
    });
  }, []);

  return {
    theme: state.theme,
    resolvedTheme: state.resolvedTheme,
    setTheme: (t: ThemeMode) => themeStore.setTheme(t),
    cycleTheme: () => themeStore.cycleTheme(),
  };
}
