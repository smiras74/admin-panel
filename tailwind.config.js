/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Guide du Détour brand colors
        limestone: {
          50: '#faf9f7',
          100: '#f5f3ef',
          200: '#e8e4dc',
          300: '#d4cdc0',
          400: '#b8ac99',
          500: '#9d8e78',
          600: '#857660',
          700: '#6d6050',
          800: '#5a5044',
          900: '#4a433a',
        },
        forest: {
          50: '#f3f6f4',
          100: '#e1e9e3',
          200: '#c5d4c9',
          300: '#9db7a5',
          400: '#73967e',
          500: '#527a5f',
          600: '#3f614a',
          700: '#334e3c',
          800: '#2a3f31',
          900: '#233429',
        },
      },
    },
  },
  plugins: [],
}
