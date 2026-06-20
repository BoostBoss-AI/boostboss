// @boostbossai/lumi-mobile — LumiProvider
//
// React Context provider that holds publisherId + session UUID. Auto-mounts
// the bottom banner so a fresh `npx @boostbossai/install-mobile` install
// starts earning on first launch with no further wiring.

import * as React from 'react';
import { View } from 'react-native';

import type { LumiContextValue } from './types';
import { BottomBanner } from './components/BottomBanner';

const LumiContext = React.createContext<LumiContextValue | null>(null);

export interface LumiProviderProps {
  publisherId: string;
  /** Disable the auto-mounted bottom banner — useful if a publisher wants
   *  fully manual placement control. Defaults to false. */
  disableBottomBanner?: boolean;
  /** Pass a context hint (e.g. current screen name) for intent scoring. */
  contextHint?: string | null;
  children?: React.ReactNode;
}

export function LumiProvider({
  publisherId,
  disableBottomBanner = false,
  contextHint,
  children,
}: LumiProviderProps): React.ReactElement {
  // Session UUID is generated once per app launch. v0 uses Math.random();
  // expo-crypto / react-native-get-random-values is the upgrade path.
  const sessionId = React.useMemo(() => randomUuid(), []);

  const value = React.useMemo<LumiContextValue>(
    () => ({
      publisherId,
      sessionId,
      surface: 'mobile-app',
    }),
    [publisherId, sessionId]
  );

  if (!publisherId) {
    // Fail open: never throw inside a publisher app. Just render children.
    // The install CLI guarantees a non-empty publisherId; defensive here.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[lumi-mobile] LumiProvider mounted without publisherId — ads disabled.'
      );
    }
    return <>{children}</>;
  }

  return (
    <LumiContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {!disableBottomBanner ? (
          <BottomBanner contextHint={contextHint ?? null} />
        ) : null}
      </View>
    </LumiContext.Provider>
  );
}

export function useLumi(): LumiContextValue {
  const ctx = React.useContext(LumiContext);
  if (!ctx) {
    // Same fail-open posture: returning a stub keeps placements as no-ops
    // when used outside the provider, rather than crashing the host app.
    return {
      publisherId: '',
      sessionId: '',
      surface: 'mobile-app',
    };
  }
  return ctx;
}

/**
 * Cheap UUID-ish for v0. Real UUID source (expo-crypto / react-native-get-
 * random-values) is the upgrade path.
 */
function randomUuid(): string {
  const r = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
}
