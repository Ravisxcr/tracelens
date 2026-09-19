/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vscode: {
          activityBar: {
            bg: '#181818',
            lightBg: '#f3f4f6',
            badge: '#007acc',
            hover: '#2a2d2e',
            border: '#2b2b2b',
          },
          sidebar: {
            bg: '#1e1e1e',
            lightBg: '#f8fafc',
            header: '#252526',
            lightHeader: '#f1f5f9',
            border: '#2b2b2b',
            lightBorder: '#e2e8f0',
            active: '#37373d',
            hover: '#2a2d2e',
          },
          editor: {
            bg: '#1e1e1e',
            lightBg: '#ffffff',
            tabBg: '#181818',
            tabLightBg: '#f3f4f6',
            tabActive: '#1e1e1e',
            tabActiveLight: '#ffffff',
            tabBorder: '#007acc',
            border: '#2b2b2b',
            lightBorder: '#e2e8f0',
          },
          panel: {
            bg: '#181818',
            lightBg: '#f8fafc',
            border: '#2b2b2b',
            lightBorder: '#e2e8f0',
            header: '#1e1e1e',
            lightHeader: '#ffffff',
          },
          statusBar: {
            bg: '#007acc',
            debugging: '#cc6633',
            hover: '#1f8ad2',
            border: '#0066aa',
            text: '#ffffff',
          },
          titleBar: {
            bg: '#1f1f1f',
            lightBg: '#f3f4f6',
            border: '#2b2b2b',
            lightBorder: '#e2e8f0',
          },
          border: '#2b2b2b',
          lightBorder: '#e2e8f0',
        },
        editor: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          panel: '#181818',
          border: '#333333',
          active: '#37373d',
          hover: '#2a2d2e',
        }
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "Menlo", "Monaco", "Consolas", "monospace"],
        sans: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "'Helvetica Neue'", "Arial", "sans-serif"],
      }
    },
  },
  plugins: [],
}
