/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0F1117',
        card: '#1A1D27',
        accent: '#E94560',
      },
    },
  },
  plugins: [],
};
