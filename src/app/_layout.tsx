import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.skyBottom,
    card: colors.wood,
    text: colors.textOnDark,
    border: colors.woodDark,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.skyBottom },
        }}>
        <Stack.Screen name="index" options={{ title: 'ヘビパズル' }} />
        <Stack.Screen name="game/[levelId]" options={{ title: '' }} />
        <Stack.Screen name="daily" options={{ title: 'きょうのもんだい' }} />
        <Stack.Screen name="my-stages" options={{ title: 'マイステージ' }} />
        <Stack.Screen name="editor" options={{ title: 'ステージエディタ' }} />
      </Stack>
    </ThemeProvider>
  );
}
