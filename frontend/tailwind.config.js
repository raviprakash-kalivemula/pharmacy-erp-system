/** @type {import('tailwindcss').Config} */
module.exports = {
  // Enable dark mode with class strategy
  darkMode: 'class',
  
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  
  theme: {
    extend: {
      // Custom colors for dark mode
      colors: {
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Dark mode specific colors
        dark: {
          bg: '#111827',
          surface: '#1f2937',
          elevated: '#374151',
          border: '#4b5563',
          text: {
            primary: '#f9fafb',
            secondary: '#d1d5db',
            tertiary: '#9ca3af',
          }
        }
      },
      
      // Custom animations
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      
      // Custom box shadows for dark mode
      boxShadow: {
        'dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  
  plugins: [],
}