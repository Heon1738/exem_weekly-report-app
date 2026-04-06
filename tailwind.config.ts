import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        notion: {
          bg: '#ffffff',
          sidebar: '#f7f7f5',
          border: '#e9e9e7',
          text: '#37352f',
          gray: '#9b9a97',
          blue: '#2383e2',
          'blue-bg': '#e7f3ff',
          'gray-bg': '#f1f1ef',
          'yellow-bg': '#fdecc8',
          'red-bg': '#ffdede',
          'green-bg': '#dbeddb',
          'purple-bg': '#e8deee',
          'orange-bg': '#fadec9',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
export default config
