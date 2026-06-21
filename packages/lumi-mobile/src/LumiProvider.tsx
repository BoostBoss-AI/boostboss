// @boostbossai/lumi-mobile — LumiProvider
//
// React Context provider that holds publisherId + session UUID. Auto-mounts
// the bottom banner so a fresh `npx @boostbossai/install-mobile` install
// starts earning on first launch with no further wiring.

import * as React from 'react';
import { View } from 'react-native';

import type { LumiContextValue } from './types';
import { BottomBanner } from './components/BottomBanner';
import { SplashSponsor } from './components/SplashSponsor';
import { fireHandshake } from './api';

const LumiContext = React.createContext<LumiContextValue | null>(null);

// Module-level gate — set once on first LumiProvider mount of an app launch.
// Reset implicitly on cold start (fresh JS bundle = fresh module scope).
let __splashShownThisLaunch = false;

export interface LumiProviderProps {
  publisherId: string;
  /** Disable the auto-mounted bottom banner — useful if a publisher wants
   *  fully manual placement control. Defaults to false. */
  disableBottomBanner?: boolean;
  /** Disable the auto-mounted SplashSponsor on cold start. Defaults to false.
   *  Per Publisher Agreement §4.1, splash auto-renders once per cold start
   *  unless explicitly suppressed. */
  disableSplashSponsor?: boolean;
  /** Pass a context hint (e.g. current screen name) for intent scoring. */
  contextHint?: string | null;
  children?: React.ReactNode;
}

export function LumiProvider({
  publisherId,
  disableBottomBanner = false,
  disableSplashSponsor = false,
  contextHint,
  children,
}: LumiProviderProps): React.ReactElement {
  // Session UUID is generated once per app launch. v0 uses Math.random();
  // expo-crypto / react-native-get-random-values is the upgrade path.
  const sessionId = React.useMemo(() => randomUuid(), []);

  // Handshake fires once per app launch so the publisher's Mobile App
  // verify badge flips from "Not started" to "Connected" the moment the
  // installed app boots up. Idempotent at the React level via useEffect
  // empty dependency array.
  React.useEffect(() => {
    if (!publisherId) return;
    fireHandshake(publisherId, sessionId).catch(() => {});
    // Intentionally empty deps — handshake is once-per-mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SplashSponsor auto-mount on cold start. Decided once per launch via
  // module-level flag so a re-mount of LumiProvider (e.g. dev hot-reload)
  // doesn't re-show the splash. Publishers can opt out per Agreement §4.1.
  const [showSplash, setShowSplash] = React.useState(() => {
    if (disableSplashSponsor) return false;
    if (__splashShownThisLaunch) return false;
    __splashShownThisLaunch = true;
    return true;
  });

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
        {showSplash ? (
          <SplashSponsor
            contextHint={contextHint ?? null}
            onDismiss={() => setShowSplash(false)}
          />
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
