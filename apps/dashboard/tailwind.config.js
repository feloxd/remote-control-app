/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#090D13',
        card: '#111821',
        accent: '#22D3C5',
      },
    },
  },
  plugins: [],
};
