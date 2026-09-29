import { Building } from 'lucide-react';
import { Link } from 'wouter';

export function Footer() {
  return (
    <footer className="bg-background border-t border-border py-12 text-center text-muted-foreground mt-auto">
      <div className="flex justify-center items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Building className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-xl text-foreground">ConstruMarket<span className="text-secondary">CR</span></span>
      </div>
      <div className="flex justify-center gap-6 mb-8 text-sm">
        <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
        <Link href="/catalogo" className="hover:text-foreground transition-colors">Catálogo</Link>
        <Link href="/sign-up" className="hover:text-foreground transition-colors">Registrarse</Link>
      </div>
      <p className="mb-2">Conectando la arquitectura y la construcción en Costa Rica.</p>
      <p className="text-sm">&copy; {new Date().getFullYear()} ConstruMarket CR. Todos los derechos reservados.</p>
    </footer>
  );
}
