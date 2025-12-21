/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tn: {
          orange: '#FF9933', // India Saffron/Orange
          white: '#FFFFFF',
          green: '#138808',  // India Green
          blue: '#000080',   // Chakra Blue - for links/highlights
        }
      }
    },
  },
  plugins: [],
}
