import { Link, useLocation } from 'wouter';
import { Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppAuth, useAppClerk } from '@/lib/app-auth';

export function Navbar() {
  const [location] = useLocation();
  const { isSignedIn } = useAppAuth();
  const { signOut } = useAppClerk();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            ConstruMarket<span className="text-secondary">CR</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <Link href="/catalogo" className={`text-sm font-medium transition-colors hidden md:block ${location === '/catalogo' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Catálogo
          </Link>
          
          {isSignedIn ? (
            <>
              <Link href="/portal" className="text-sm font-medium transition-colors hidden md:block text-muted-foreground hover:text-foreground">
                Mi Portal
              </Link>
              <Button variant="outline" size="sm" className="px-2.5 sm:px-3" onClick={() => signOut({ redirectUrl: '/' })}>
                Cerrar Sesión
              </Button>
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost" className="hidden md:inline-flex">Ingresar</Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-primary text-primary-foreground">Comenzar</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
