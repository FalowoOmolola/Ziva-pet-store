import { createContext, useContext } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

const palettes = {
  dark: {
  black: '#0d0d0d',
  surface: '#161616',
  card: '#1f1f1f',
  muted: '#282828',
  line: 'rgba(255,255,255,.07)',
  green: '#a8e040',
  greenSoft: 'rgba(168,224,64,.10)',
  greenLine: 'rgba(168,224,64,.22)',
  text: '#f0efe8',
  sub: '#a8a89e',
  dim: '#606058',
  red: '#f05252',
  amber: '#f5a623',
  blue: '#60a5fa',
  },
  light: {
    black: '#f8faf5',
    surface: '#eef3e7',
    card: '#ffffff',
    muted: '#e4eadc',
    line: 'rgba(13,13,13,.09)',
    green: '#6f9f24',
    greenSoft: 'rgba(111,159,36,.12)',
    greenLine: 'rgba(111,159,36,.28)',
    text: '#161a12',
    sub: '#4b5642',
    dim: '#7c8573',
    red: '#d43f3f',
    amber: '#c47d12',
    blue: '#2563eb',
  },
};

const colors = palettes.dark;
const ThemeContext = createContext(colors);

function makeMap(palette) {
  return {
  flex: { display: 'flex' },
  'flex-1': { flex: 1 },
  'flex-row': { flexDirection: 'row' },
  'flex-wrap': { flexWrap: 'wrap' },
  'items-center': { alignItems: 'center' },
  'items-start': { alignItems: 'flex-start' },
  'justify-center': { justifyContent: 'center' },
  'justify-between': { justifyContent: 'space-between' },
  'justify-end': { justifyContent: 'flex-end' },
  'self-end': { alignSelf: 'flex-end' },
  'overflow-hidden': { overflow: 'hidden' },
  'text-center': { textAlign: 'center' },
  uppercase: { textTransform: 'uppercase' },
  'font-bold': { fontWeight: '700' },
  'font-extrabold': { fontWeight: '800' },
  'font-medium': { fontWeight: '500' },
  'font-normal': { fontWeight: '400' },
  'bg-black': { backgroundColor: palette.black },
  'bg-surface': { backgroundColor: palette.surface },
  'bg-card': { backgroundColor: palette.card },
  'bg-muted': { backgroundColor: palette.muted },
  'bg-green': { backgroundColor: palette.green },
  'bg-green-soft': { backgroundColor: palette.greenSoft },
  'bg-red-soft': { backgroundColor: 'rgba(240,82,82,.15)' },
  'text-black': { color: palette.black },
  'text-text': { color: palette.text },
  'text-sub': { color: palette.sub },
  'text-dim': { color: palette.dim },
  'text-green': { color: palette.green },
  'text-red': { color: palette.red },
  'text-amber': { color: palette.amber },
  'text-blue': { color: palette.blue },
  border: { borderWidth: 1 },
  'border-line': { borderColor: palette.line },
  'border-green': { borderColor: palette.green },
  'border-green-line': { borderColor: palette.greenLine },
  'border-red-line': { borderColor: 'rgba(240,82,82,.3)' },
  'border-t': { borderTopWidth: 1 },
  'border-b': { borderBottomWidth: 1 },
  };
}

const spacing = {
  0: 0,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
};

const fontSizes = {
  'text-2xs': 9,
  'text-xs': 10,
  'text-sm': 12,
  'text-base': 14,
  'text-lg': 16,
  'text-xl': 18,
  'text-2xl': 20,
  'text-3xl': 24,
  'text-4xl': 28,
};

const round = {
  rounded: 4,
  'rounded-md': 6,
  'rounded-lg': 8,
  'rounded-xl': 10,
  'rounded-2xl': 12,
  'rounded-3xl': 16,
  'rounded-full': 999,
};

function numeric(value) {
  return Number.parseFloat(value);
}

function resolveToken(token, palette) {
  const map = makeMap(palette);
  if (map[token]) return map[token];
  if (fontSizes[token]) return { fontSize: fontSizes[token] };
  if (round[token]) return { borderRadius: round[token] };

  const [prefix, raw] = token.split('-');
  const value = spacing[raw] ?? numeric(raw);
  if (Number.isNaN(value)) return null;

  switch (prefix) {
    case 'p':
      return { padding: value };
    case 'px':
      return { paddingHorizontal: value };
    case 'py':
      return { paddingVertical: value };
    case 'pt':
      return { paddingTop: value };
    case 'pb':
      return { paddingBottom: value };
    case 'pl':
      return { paddingLeft: value };
    case 'pr':
      return { paddingRight: value };
    case 'm':
      return { margin: value };
    case 'mt':
      return { marginTop: value };
    case 'mb':
      return { marginBottom: value };
    case 'ml':
      return { marginLeft: value };
    case 'mr':
      return { marginRight: value };
    case 'gap':
      return { gap: value };
    case 'w':
      return { width: value };
    case 'h':
      return { height: value };
    case 'border':
      return { borderWidth: raw ? value : 1 };
    case 'leading':
      return { lineHeight: value };
    default:
      return null;
  }
}

export function tw(className = '', palette = colors) {
  return className
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => resolveToken(token, palette))
    .filter(Boolean);
}

function withTw(Component) {
  return function TailwindComponent({ className, style, ...props }) {
    const palette = useContext(ThemeContext);
    return <Component {...props} style={[tw(className, palette), style]} />;
  };
}

export function AppThemeProvider({ mode = 'dark', children }) {
  return <ThemeContext.Provider value={palettes[mode] || palettes.dark}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export const TView = withTw(View);
export const TText = withTw(Text);
export const TPressable = withTw(Pressable);
export const TScrollView = withTw(ScrollView);
export const TTextInput = withTw(TextInput);
export { colors, palettes };
