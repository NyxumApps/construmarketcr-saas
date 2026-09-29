import type { ComponentProps, ReactNode } from 'react';
import {
  ClerkProvider,
  Show as ClerkShow,
  useAuth as useClerkAuth,
  useClerk,
} from '@clerk/react';

const e2eMode = import.meta.env.VITE_E2E_MODE === 'true';
const e2eUserKey = 'construmarket-e2e-user';

export function getE2eUserId(): string | null {
  return e2eMode ? window.localStorage.getItem(e2eUserKey) : null;
}

export function AppAuthProvider({
  children,
  ...clerkProps
}: { children: ReactNode } & ComponentProps<typeof ClerkProvider>) {
  if (e2eMode) return <>{children}</>;
  return <ClerkProvider {...clerkProps}>{children}</ClerkProvider>;
}

export function AuthShow({
  when,
  children,
}: {
  when: 'signed-in' | 'signed-out';
  children: ReactNode;
}) {
  if (!e2eMode) return <ClerkShow when={when}>{children}</ClerkShow>;
  const signedIn = Boolean(getE2eUserId());
  return when === (signedIn ? 'signed-in' : 'signed-out') ? <>{children}</> : null;
}

export function useAppAuth() {
  if (!e2eMode) return useClerkAuth();
  return { isSignedIn: Boolean(getE2eUserId()) };
}

export function useAppClerk() {
  if (!e2eMode) return useClerk();
  return {
    signOut: async ({ redirectUrl = '/' }: { redirectUrl?: string } = {}) => {
      window.localStorage.removeItem(e2eUserKey);
      window.location.assign(redirectUrl);
    },
    addListener: () => () => {},
  };
}