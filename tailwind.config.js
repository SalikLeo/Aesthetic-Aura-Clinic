/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-bg': '#1a1a1a',
        'secondary-bg': '#2a2a2a',
        'accent': '#059669', // Emerald 600
        'accent-hover': '#10b981', // Emerald 500
        'success': '#10b981',
        'warning': '#f59e0b',
        'danger': '#ef4444',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
      fontWeight: {
        normal: '500',
        bold: '700',
      },
    },
  },
  plugins: [],
}
