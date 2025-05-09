/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Primary color variants
    'bg-primary-50', 'bg-primary-100', 'bg-primary-200', 'bg-primary-300', 'bg-primary-400',
    'bg-primary-500', 'bg-primary-600', 'bg-primary-700', 'bg-primary-800', 'bg-primary-900',
    'text-primary-50', 'text-primary-100', 'text-primary-200', 'text-primary-300', 'text-primary-400',
    'text-primary-500', 'text-primary-600', 'text-primary-700', 'text-primary-800', 'text-primary-900',
    'border-primary-50', 'border-primary-100', 'border-primary-200', 'border-primary-300', 'border-primary-400',
    'border-primary-500', 'border-primary-600', 'border-primary-700', 'border-primary-800', 'border-primary-900',
    
    // ZK color variants
    'bg-zk', 'text-zk', 'border-zk',
    'bg-zk-accent', 'text-zk-accent', 'border-zk-accent',
    'bg-zk-accent-dark', 'text-zk-accent-dark', 'border-zk-accent-dark',
    'bg-zk-light', 'text-zk-light', 'border-zk-light',
    
    // Gray variants
    'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-gray-300', 'bg-gray-400',
    'bg-gray-500', 'bg-gray-600', 'bg-gray-700', 'bg-gray-800', 'bg-gray-900',
    'text-gray-50', 'text-gray-100', 'text-gray-200', 'text-gray-300', 'text-gray-400',
    'text-gray-500', 'text-gray-600', 'text-gray-700', 'text-gray-800', 'text-gray-900',
    
    // Hover variants
    'hover:bg-primary-700', 'hover:bg-primary-600', 'hover:bg-primary-500',
    'hover:bg-zk-accent', 'hover:bg-zk-accent-dark',
    'hover:text-primary-700', 'hover:text-gray-700',
    'hover:border-gray-300', 'hover:underline',
    
    // Layout utilities
    'flex', 'flex-col', 'flex-row', 'items-center', 'justify-center', 'justify-between',
    'min-h-screen', 'h-screen', 'w-full', 'flex-grow', 'flex-shrink-0',
    'container', 'mx-auto', 'my-auto',
    
    // Spacing
    'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-8', 'p-10', 'p-12',
    'px-1', 'px-2', 'px-3', 'px-4', 'px-5', 'px-6', 'px-8', 'px-10', 'px-12',
    'py-1', 'py-2', 'py-3', 'py-4', 'py-5', 'py-6', 'py-8', 'py-10', 'py-12',
    'm-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6', 'm-8', 'm-10', 'm-12',
    'mx-1', 'mx-2', 'mx-3', 'mx-4', 'mx-5', 'mx-6', 'mx-8', 'mx-10', 'mx-12',
    'my-1', 'my-2', 'my-3', 'my-4', 'my-5', 'my-6', 'my-8', 'my-10', 'my-12',
    
    // Typography
    'text-center', 'text-left', 'text-right',
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl',
    'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold',
    
    // Misc
    'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl',
    'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full',
    'opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100',
    'z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50', 'z-auto',
    'overflow-hidden', 'overflow-visible', 'overflow-scroll', 'overflow-auto',
    'static', 'fixed', 'absolute', 'relative', 'sticky',
    'top-0', 'right-0', 'bottom-0', 'left-0',
    
    // Custom classes
    'wallet-selector', 'logo-pop', 'nav-link-active', 'btn', 'btn-primary', 'btn-secondary', 'btn-zk',
    'wallet-modal-container', 'carousel', 'carousel-inner', 'carousel-item', 'feature-card',
    'animate-float', 'pulse-glow',
  ],
  theme: {
    extend: {
      colors: {
        // Use standard Tailwind colors as the base
        gray: colors.gray,
        red: colors.red,
        orange: colors.orange,
        amber: colors.amber,
        yellow: colors.yellow,
        lime: colors.lime,
        green: colors.green,
        emerald: colors.emerald,
        teal: colors.teal,
        cyan: colors.cyan,
        sky: colors.sky,
        blue: colors.blue,
        indigo: colors.indigo,
        violet: colors.violet,
        purple: colors.purple,
        fuchsia: colors.fuchsia,
        pink: colors.pink,
        rose: colors.rose,
        
        // Custom colors defined in our CSS variables
        primary: {
          50: '#F5F3FF', // Manually set these to exact colors instead of using RGB variables
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },
        zk: {
          DEFAULT: '#047857', // Corresponds to --color-zk
          accent: '#10B981', // Corresponds to --zk-accent
          'accent-dark': '#059669', // Corresponds to --zk-accent-dark
          light: '#D1FAE5', // Corresponds to --zk-accent-light
        },
      },
    },
  },
  plugins: [],
};