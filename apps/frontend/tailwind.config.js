/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Use CSS custom properties for theme-aware colors
      colors: {
        // Semantic colors using CSS custom properties
        'theme': {
          'background': 'rgb(var(--color-background))',
          'background-secondary': 'rgb(var(--color-background-secondary))',
          'background-tertiary': 'rgb(var(--color-background-tertiary))',
          'background-muted': 'rgb(var(--color-background-muted))',

          'surface': 'rgb(var(--color-surface))',
          'surface-secondary': 'rgb(var(--color-surface-secondary))',
          'surface-tertiary': 'rgb(var(--color-surface-tertiary))',
          'surface-hover': 'rgb(var(--color-surface-hover))',
          'surface-active': 'rgb(var(--color-surface-active))',
          'surface-elevated': 'rgb(var(--color-surface-elevated))',

          'border': 'rgb(var(--color-border))',
          'border-secondary': 'rgb(var(--color-border-secondary))',
          'border-muted': 'rgb(var(--color-border-muted))',
          'border-strong': 'rgb(var(--color-border-strong))',

          'text': 'rgb(var(--color-text))',
          'text-secondary': 'rgb(var(--color-text-secondary))',
          'text-tertiary': 'rgb(var(--color-text-tertiary))',
          'text-muted': 'rgb(var(--color-text-muted))',
          'text-disabled': 'rgb(var(--color-text-disabled))',
          'text-inverse': 'rgb(var(--color-text-inverse))',

          'interactive': 'rgb(var(--color-interactive))',
          'interactive-hover': 'rgb(var(--color-interactive-hover))',
          'interactive-active': 'rgb(var(--color-interactive-active))',
          'interactive-disabled': 'rgb(var(--color-interactive-disabled))',

          'focus': 'rgb(var(--color-focus))',
          'focus-ring': 'rgb(var(--color-focus-ring))',

          'success': 'rgb(var(--color-success-600))',
          'error': 'rgb(var(--color-danger-600))',
          'warning': 'rgb(var(--color-warning-600))',
          'info': 'rgb(var(--color-info-600))',

          'error-background': 'rgba(var(--color-danger-50), 0.5)',
          'error-border': 'rgb(var(--color-danger-200))',
        },

        // Component-specific colors
        'button': {
          'primary': 'var(--color-button-primary)',
          'primary-hover': 'var(--color-button-primary-hover)',
          'primary-active': 'var(--color-button-primary-active)',
          'primary-text': 'var(--color-button-primary-text)',
          'secondary': 'var(--color-button-secondary)',
          'secondary-hover': 'var(--color-button-secondary-hover)',
          'secondary-active': 'var(--color-button-secondary-active)',
          'secondary-text': 'var(--color-button-secondary-text)',
          'danger': 'var(--color-button-danger)',
          'danger-hover': 'var(--color-button-danger-hover)',
          'danger-text': 'var(--color-button-danger-text)',
          'success': 'var(--color-button-success)',
          'success-hover': 'var(--color-button-success-hover)',
          'success-text': 'var(--color-button-success-text)',
        },

        'card': {
          'background': 'var(--color-card-background)',
          'border': 'var(--color-card-border)',
        },

        'input': {
          'background': 'var(--color-input-background)',
          'border': 'var(--color-input-border)',
          'border-focus': 'var(--color-input-border-focus)',
          'text': 'var(--color-input-text)',
          'placeholder': 'var(--color-input-placeholder)',
        },

        'nav': {
          'background': 'var(--color-nav-background)',
          'border': 'var(--color-nav-border)',
          'text': 'var(--color-nav-text)',
          'text-hover': 'var(--color-nav-text-hover)',
          'text-active': 'var(--color-nav-text-active)',
          'background-hover': 'var(--color-nav-background-hover)',
          'background-active': 'var(--color-nav-background-active)',
        },

        // Status colors
        'status': {
          'new': 'var(--color-status-new)',
          'new-text': 'var(--color-status-new-text)',
          'new-border': 'var(--color-status-new-border)',
          'investigating': 'var(--color-status-investigating)',
          'investigating-text': 'var(--color-status-investigating-text)',
          'investigating-border': 'var(--color-status-investigating-border)',
          'resolved': 'var(--color-status-resolved)',
          'resolved-text': 'var(--color-status-resolved-text)',
          'resolved-border': 'var(--color-status-resolved-border)',
        },

        // Severity colors
        'severity': {
          'critical': 'var(--color-severity-critical)',
          'high': 'var(--color-severity-high)',
          'medium': 'var(--color-severity-medium)',
          'low': 'var(--color-severity-low)',
          'info': 'var(--color-severity-info)',
        },

        // Base color scale using CSS custom properties
        'primary': {
          50: 'rgb(var(--color-primary-50))',
          75: 'rgb(var(--color-primary-75))',
          100: 'rgb(var(--color-primary-100))',
          200: 'rgb(var(--color-primary-200))',
          300: 'rgb(var(--color-primary-300))',
          400: 'rgb(var(--color-primary-400))',
          500: 'rgb(var(--color-primary-500))',
          600: 'rgb(var(--color-primary-600))',
          700: 'rgb(var(--color-primary-700))',
          800: 'rgb(var(--color-primary-800))',
          900: 'rgb(var(--color-primary-900))',
          950: 'rgb(var(--color-primary-950))',
        },

        'neutral': {
          0: 'rgb(var(--color-neutral-0))',
          25: 'rgb(var(--color-neutral-25))',
          50: 'rgb(var(--color-neutral-50))',
          75: 'rgb(var(--color-neutral-75))',
          100: 'rgb(var(--color-neutral-100))',
          150: 'rgb(var(--color-neutral-150))',
          200: 'rgb(var(--color-neutral-200))',
          250: 'rgb(var(--color-neutral-250))',
          300: 'rgb(var(--color-neutral-300))',
          400: 'rgb(var(--color-neutral-400))',
          500: 'rgb(var(--color-neutral-500))',
          600: 'rgb(var(--color-neutral-600))',
          700: 'rgb(var(--color-neutral-700))',
          800: 'rgb(var(--color-neutral-800))',
          900: 'rgb(var(--color-neutral-900))',
          950: 'rgb(var(--color-neutral-950))',
        },

        'soc-dark': {
          50: 'rgb(var(--color-neutral-50))',
          100: 'rgb(var(--color-neutral-100))',
          200: 'rgb(var(--color-neutral-200))',
          300: 'rgb(var(--color-neutral-300))',
          400: 'rgb(var(--color-neutral-400))',
          500: 'rgb(var(--color-neutral-500))',
          600: 'rgb(var(--color-neutral-600))',
          700: 'rgb(var(--color-neutral-700))',
          800: 'rgb(var(--color-neutral-800))',
          900: 'rgb(var(--color-neutral-900))',
          950: 'rgb(var(--color-neutral-950))',
        },
      },

      // Typography using CSS custom properties
      fontFamily: {
        'sans': 'var(--font-family-sans)',
        'mono': 'var(--font-family-mono)',
      },

      fontSize: {
        'xs': 'var(--font-size-xs)',
        'sm': 'var(--font-size-sm)',
        'base': 'var(--font-size-base)',
        'lg': 'var(--font-size-lg)',
        'xl': 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
      },

      fontWeight: {
        'normal': 'var(--font-weight-normal)',
        'medium': 'var(--font-weight-medium)',
        'semibold': 'var(--font-weight-semibold)',
        'bold': 'var(--font-weight-bold)',
      },

      lineHeight: {
        'tight': 'var(--line-height-tight)',
        'snug': 'var(--line-height-snug)',
        'normal': 'var(--line-height-normal)',
        'relaxed': 'var(--line-height-relaxed)',
      },

      // Spacing using CSS custom properties
      spacing: {
        '0': 'var(--spacing-0)',
        'px': 'var(--spacing-px)',
        '0.5': 'var(--spacing-0-5)',
        '1': 'var(--spacing-1)',
        '1.5': 'var(--spacing-1-5)',
        '2': 'var(--spacing-2)',
        '2.5': 'var(--spacing-2-5)',
        '3': 'var(--spacing-3)',
        '3.5': 'var(--spacing-3-5)',
        '4': 'var(--spacing-4)',
        '5': 'var(--spacing-5)',
        '6': 'var(--spacing-6)',
        '8': 'var(--spacing-8)',
        '10': 'var(--spacing-10)',
        '12': 'var(--spacing-12)',
        '16': 'var(--spacing-16)',
        '20': 'var(--spacing-20)',
        '24': 'var(--spacing-24)',
      },

      // Border colors using CSS custom properties
      borderColor: {
        'theme': 'rgb(var(--color-border))',
        'theme-secondary': 'rgb(var(--color-border-secondary))',
        'theme-muted': 'rgb(var(--color-border-muted))',
        'theme-strong': 'rgb(var(--color-border-strong))',
        'DEFAULT': 'rgb(var(--color-border))',
      },

      // Border radius using CSS custom properties
      borderRadius: {
        'none': 'var(--radius-none)',
        'sm': 'var(--radius-sm)',
        'base': 'var(--radius-base)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      },

      // Enhanced Professional Shadow System
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'base': 'var(--shadow-base)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',

        // Professional Component Shadows
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'card-focus': 'var(--shadow-card-focus)',
        'button': 'var(--shadow-button)',
        'button-hover': 'var(--shadow-button-hover)',
        'modal': 'var(--shadow-modal)',
        'dropdown': 'var(--shadow-dropdown)',
        'nav': 'var(--shadow-nav)',
        'nav-fixed': 'var(--shadow-nav-fixed)',

        // Legacy light shadows for backward compatibility
        'light': 'var(--shadow-sm)',
        'light-md': 'var(--shadow-base)',
        'light-lg': 'var(--shadow-md)',
        'light-xl': 'var(--shadow-lg)',
      },

      // Animation and transition durations
      transitionDuration: {
        '75': 'var(--duration-75)',
        '100': 'var(--duration-100)',
        '150': 'var(--duration-150)',
        '200': 'var(--duration-200)',
        '300': 'var(--duration-300)',
        '500': 'var(--duration-500)',
        '700': 'var(--duration-700)',
        '1000': 'var(--duration-1000)',
      },

      transitionTimingFunction: {
        'linear': 'var(--ease-linear)',
        'in': 'var(--ease-in)',
        'out': 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },

      // Enhanced animations
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.2s cubic-bezier(0, 0, 0.2, 1)',
        'slide-in-right': 'slideInFromRight 0.3s cubic-bezier(0, 0, 0.2, 1)',
        'slide-in-left': 'slideInFromLeft 0.3s cubic-bezier(0, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.2s cubic-bezier(0, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },

  // Custom utilities for theme-aware styling
  plugins: [
    // Plugin to generate theme utility classes
    function({ addUtilities }) {
      addUtilities({
        // Theme-aware utility classes
        '.theme-bg': {
          'background-color': 'rgb(var(--color-background))',
        },
        '.theme-bg-surface': {
          'background-color': 'rgb(var(--color-surface))',
        },
        '.theme-text': {
          'color': 'rgb(var(--color-text))',
        },
        '.theme-text-secondary': {
          'color': 'rgb(var(--color-text-secondary))',
        },
        '.theme-text-muted': {
          'color': 'rgb(var(--color-text-muted))',
        },
        '.theme-border': {
          'border-color': 'rgb(var(--color-border))',
        },
        // Additional theme utilities for pagination and buttons
        '.bg-surface-hover': {
          'background-color': 'rgb(var(--color-surface-hover))',
        },
        '.text-text': {
          'color': 'rgb(var(--color-text))',
        },
        '.text-text-strong': {
          'color': 'rgb(var(--color-text))',
        },
        '.theme-button-primary': {
          'background-color': 'var(--color-button-primary)',
          'color': 'var(--color-button-primary-text)',
          '&:hover': {
            'background-color': 'var(--color-button-primary-hover)',
          },
          '&:active': {
            'background-color': 'var(--color-button-primary-active)',
          },
        },
        '.theme-button-secondary': {
          'background-color': 'var(--color-button-secondary)',
          'color': 'var(--color-button-secondary-text)',
          '&:hover': {
            'background-color': 'var(--color-button-secondary-hover)',
          },
          '&:active': {
            'background-color': 'var(--color-button-secondary-active)',
          },
        },
        '.theme-card': {
          'background-color': 'var(--color-card-background)',
          'border-color': 'var(--color-card-border)',
          'box-shadow': 'var(--shadow-card)',
        },
        '.theme-input': {
          'background-color': 'var(--color-input-background)',
          'border-color': 'var(--color-input-border)',
          'color': 'var(--color-input-text)',
          '&:focus': {
            'border-color': 'var(--color-input-border-focus)',
            'box-shadow': '0 0 0 1px var(--color-focus-ring)',
          },
          '&::placeholder': {
            'color': 'var(--color-input-placeholder)',
          },
        },
        // Scrollbar utilities
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'var(--color-scrollbar-thumb) var(--color-scrollbar-track)',
          '&::-webkit-scrollbar': {
            'width': '6px',
          },
          '&::-webkit-scrollbar-track': {
            'background': 'var(--color-scrollbar-track)',
          },
          '&::-webkit-scrollbar-thumb': {
            'background-color': 'var(--color-scrollbar-thumb)',
            'border-radius': 'var(--radius-sm)',
          },
        },
      });
    },
  ],

  // Dark mode configuration
  darkMode: 'class',
}
