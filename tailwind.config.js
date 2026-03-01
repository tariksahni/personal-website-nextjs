/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  content: [
    './pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        purps: {
          10: '#f8f6ff',
          20: '#f3e9ff',
          30: '#ecd9ff',
          50: '#d9b3ff',
          100: '#cc99ff',
          200: '#c68cff',
          300: '#b266ff',
          400: '#9933ff',
          500: '#8000ff',
          600: '#7300e5',
          700: '#6600cc',
          800: '#330066',
          900: '#150029',
        },
        grey: {
          50: '#fafafa',
          100: '#f8f8f8',
          200: '#f0f0f0',
          300: '#e2e2e2',
          400: '#c4c4c4',
          500: '#9f9f9f',
          600: '#888888',
          700: '#666666',
          800: '#444444',
          900: '#222222',
        },
        candy: {
          100: '#fff2f8',
          500: '#ff007a',
          600: '#e5006e',
        },
        okaygreen: {
          100: '#f1fff2',
          500: '#15d676',
          600: '#10a35a',
        },
        warningred: {
          100: '#ffe5e5',
          500: '#ef0404',
          600: '#d60404',
        },
      },
    },
  },
  plugins: [],
}
