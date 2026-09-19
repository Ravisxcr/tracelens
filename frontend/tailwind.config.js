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
        editor: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          panel: '#181818',
          border: '#333333',
          active: '#37373d',
          hover: '#2a2d2e',
        }
      }
    },
  },
  plugins: [],
}

