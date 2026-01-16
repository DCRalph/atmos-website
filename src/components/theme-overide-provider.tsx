"use client";

import * as React from "react";
import { ThemeProvider } from "~/components/theme-provider";

type ThemeOverrideContextType = {
  forcedTheme: string | undefined;
  setForcedTheme: (theme: string | undefined) => void;
};

const ThemeOverrideContext = React.createContext<
  ThemeOverrideContextType | undefined
>(undefined);

export function useThemeOverride() {
  const context = React.useContext(ThemeOverrideContext);
  if (!context) {
    throw new Error(
      "useThemeOverride must be used within ThemeOverrideProvider",
    );
  }
  return context;
}

export function ThemeOverrideProvider({
  children,
  defaultForcedTheme,
}: {
  children: React.ReactNode;
  defaultForcedTheme?: string;
}) {
  const [forcedTheme, setForcedTheme] = React.useState<string | undefined>(
    defaultForcedTheme,
  );

  return (
    <ThemeOverrideContext.Provider value={{ forcedTheme, setForcedTheme }}>
      <ThemeProvider
        attribute="class"
        defaultTheme={defaultForcedTheme ?? "dark"}
        forcedTheme={forcedTheme ?? defaultForcedTheme ?? "dark"}
      >
        {children}
      </ThemeProvider>
    </ThemeOverrideContext.Provider>
  );
}
