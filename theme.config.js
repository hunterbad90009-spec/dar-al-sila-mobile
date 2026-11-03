/**
 * دار السلع brand tokens (spec §6): dark green #0B1F17 and gold #D4AF37.
 * Every screen reads colors through useColors(); do not hard-code brand hex values.
 * @type {const}
 */
const themeColors = {
  primary: { light: '#0B1F17', dark: '#3E9B76' },
  primaryText: { light: '#FFFFFF', dark: '#06130E' },
  accent: { light: '#D4AF37', dark: '#E2C25B' },
  accentSoft: { light: '#F6EDCF', dark: '#3A321A' },
  background: { light: '#F8F6F1', dark: '#0E1512' },
  surface: { light: '#FFFFFF', dark: '#17211C' },
  surfaceAlt: { light: '#F1EEE6', dark: '#1E2A24' },
  foreground: { light: '#0B1F17', dark: '#F2EEE4' },
  muted: { light: '#6B7268', dark: '#A9B0A6' },
  border: { light: '#E6E1D6', dark: '#2C3933' },
  success: { light: '#1F7A52', dark: '#5CC494' },
  warning: { light: '#A8761C', dark: '#E0B458' },
  error: { light: '#B3372F', dark: '#F08378' },
};

module.exports = { themeColors };
