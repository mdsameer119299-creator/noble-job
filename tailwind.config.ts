import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Noble Job Brand Colors (from --blue, --navy, --orange etc.) ──
      colors: {
        'noble-blue':    '#1847d4',   // --blue: primary CTA, nav active, headings
        'noble-navy':    '#0d1f4e',   // --navy: main dark background text, footer
        'noble-navy2':   '#0a1635',   // --navy2: footer background
        'noble-navy3':   '#060e28',   // --navy3: darkest footer / NCC banner bg
        'noble-orange':  '#f07020',   // --orange: CTA buttons (Post a Job, Apply)
        'noble-green':   '#15803d',   // --green: salary text, success states
        'noble-red':     '#dc2626',   // --red: errors, closed badges
        'noble-border':  '#e2e8f0',   // --border: all card/input borders
        'noble-border2': '#c7d3e8',   // --border2: secondary borders
        't1':            '#0d1f4e',   // --t1: primary text (dark navy)
        't2':            '#374151',   // --t2: secondary text (dark grey)
        't3':            '#6b7280',   // --t3: muted text
        't4':            '#9ca3af',   // --t4: placeholder text
      },

      // ── Noble Job Typography ──
      fontFamily: {
        playfair: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        sans:     ['var(--font-dm-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
      },

      // ── Spacing ──
      spacing: {
        'sidebar': '230px',   // --sw: employer/candidate/admin sidebar width
      },

      // ── Border Radius ──
      borderRadius: {
        'card':  '16px',   // Standard Noble Job card radius
        'btn':   '10px',   // Standard button radius
        'pill':  '24px',   // WFH pill nav radius
      },

      // ── Box Shadows ──
      boxShadow: {
        'card':     '0 4px 20px rgba(24,71,212,0.08)',
        'card-hover': '0 8px 28px rgba(24,71,212,0.12)',
        'btn':      '0 3px 10px rgba(240,112,32,0.3)',
        'btn-hover':'0 5px 16px rgba(240,112,32,0.4)',
        'blue':     '0 4px 16px rgba(24,71,212,0.15)',
        'blue-lg':  '0 8px 28px rgba(24,71,212,0.20)',
      },

      // ── Gradients (NCC Banner, hero, WFH pill) ──
      backgroundImage: {
        'noble-gradient':  'linear-gradient(135deg, #1847d4, #0d1f4e)',
        'wfh-pill':        'linear-gradient(135deg, #1847d4, #7c3aed)',
        'ncc-banner':      'linear-gradient(135deg, #1847d4, #060e28)',
        'hero-gradient':   'linear-gradient(to bottom right, #0d1f4e, #1847d4)',
        'orange-gradient': 'linear-gradient(135deg, #f07020, #d95e10)',
      },

      // ── Animation ──
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'spin': { to: { transform: 'rotate(360deg)' } },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'spin':     'spin 0.8s linear infinite',
        'shake':    'shake 0.4s ease',
      },
    },
  },
  plugins: [],
}

export default config
