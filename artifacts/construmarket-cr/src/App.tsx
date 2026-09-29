import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { esES } from '@clerk/localizations';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Catalogo from '@/pages/catalogo';
import PlanDetail from '@/pages/plan';
import PortalIndex from '@/pages/portal';
import PortalProfesional from '@/pages/portal-profesional';
import PortalPlanos from '@/pages/portal-planos';
import AdminDashboard from '@/pages/admin';
import { AppAuthProvider, AuthShow, getE2eUserId, useAppClerk } from '@/lib/app-auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(160 40% 15%)', // --primary
    colorForeground: 'hsl(160 20% 10%)',
    colorMutedForeground: 'hsl(160 10% 40%)',
    colorDanger: 'hsl(0 84% 60%)',
    colorBackground: 'hsl(0 0% 100%)', // --card
    colorInput: 'hsl(0 0% 100%)', // --card
    colorInputForeground: 'hsl(160 20% 10%)',
    colorNeutral: 'hsl(105 10% 87%)', // --border
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.5rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[hsl(105_10%_87%)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display font-bold text-2xl text-[hsl(160_20%_10%)]',
    headerSubtitle: 'text-[hsl(160_10%_40%)] text-base mt-2',
    socialButtonsBlockButtonText: 'font-medium',
    formFieldLabel: 'font-medium text-[hsl(160_20%_10%)]',
    footerActionLink: 'text-[hsl(160_40%_15%)] hover:text-[hsl(15_60%_50%)] transition-colors',
    footerActionText: 'text-[hsl(160_10%_40%)]',
    dividerText: 'text-[hsl(160_10%_40%)] bg-white px-2',
    identityPreviewEditButton: 'text-[hsl(160_40%_15%)]',
    formFieldSuccessText: 'text-[hsl(160_40%_15%)]',
    alertText: 'text-sm font-medium',
    logoBox: 'mb-4',
    logoImage: 'h-10 w-auto',
    socialButtonsBlockButton: 'border-[hsl(105_10%_87%)] hover:bg-[hsl(40_30%_98%)] transition-colors',
    formButtonPrimary: 'bg-[hsl(160_40%_15%)] hover:bg-[hsl(160_40%_10%)] text-white h-11 font-medium transition-colors',
    formFieldInput: 'border-[hsl(105_10%_87%)] focus:border-[hsl(160_40%_15%)] focus:ring-1 focus:ring-[hsl(160_40%_15%)] transition-all',
    footerAction: 'justify-center',
    dividerLine: 'bg-[hsl(105_10%_87%)]',
    alert: 'border border-[hsl(0_84%_60%)] bg-[hsl(0_84%_95%)]',
    otpCodeFieldInput: 'border-[hsl(105_10%_87%)]',
    formFieldRow: 'space-y-4',
    main: 'gap-6',
  },
};

function SignInPage() {
  if (import.meta.env.VITE_E2E_MODE === 'true') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <button
          className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground"
          onClick={() => window.location.assign(getE2eUserId() ? `${basePath}/portal` : `${basePath}/`)}
        >
          Iniciar sesión de prueba
        </button>
      </div>
    );
  }
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background z-10" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  const isProfessionalSignup =
    new URLSearchParams(window.location.search).get('intent') === 'professional';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background z-10" />
      </div>
      <div className="relative z-10 w-full max-w-md py-12">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          forceRedirectUrl={
            isProfessionalSignup
              ? `${basePath}/portal/profesional`
              : `${basePath}/portal`
          }
        />
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useAppClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function HomeRedirect() {
  return (
    <>
      <AuthShow when="signed-in">
        <Redirect to="/portal" />
      </AuthShow>
      <AuthShow when="signed-out">
        <Home />
      </AuthShow>
    </>
  );
}

function SignedInRoute({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthShow when="signed-in">{children}</AuthShow>
      <AuthShow when="signed-out">
        <Redirect to="/" />
      </AuthShow>
    </>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/catalogo" component={Catalogo} />
        <Route path="/plan/:id" component={PlanDetail} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/portal">
          <SignedInRoute><PortalIndex /></SignedInRoute>
        </Route>
        <Route path="/portal/profesional">
          <SignedInRoute><PortalProfesional /></SignedInRoute>
        </Route>
        <Route path="/portal/planos">
          <SignedInRoute><PortalPlanos /></SignedInRoute>
        </Route>
        <Route path="/admin">
          <SignedInRoute><AdminDashboard /></SignedInRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <AppAuthProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={esES}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AppAuthProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
