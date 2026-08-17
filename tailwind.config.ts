import type { Config } from 'tailwindcss';

// Design tokens ported 1:1 from the original prototype's CSS variables,
// so any screen can be rebuilt with the exact same palette.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF8F2',
        creamDeep: '#F1EBDD',
        card: '#FFFFFF',
        sageDeep: '#3C5443',
        sage: '#6C8873',
        sageSoft: '#C3D3C4',
        sageMist: '#EAF0E9',
        blush: '#E7BCAC',
        blushSoft: '#F6E4DB',
        ink: '#26241F',
        stone: '#8B8579',
        stoneLight: '#C9C2B4',
        coral: '#C0664E',
        line: '#E9E2D2',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'sans-serif'],
        num: ['"Space Grotesk"', 'sans-serif'],
      },
      borderRadius: { lg: '26px', md: '18px', sm: '12px' },
      boxShadow: { card: '0 10px 30px -14px rgba(60,84,67,0.25)' },
    },
  },
  plugins: [],
} satisfies Config;
