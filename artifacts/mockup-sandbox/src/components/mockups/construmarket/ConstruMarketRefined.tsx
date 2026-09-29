import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BedDouble,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Home,
  Menu,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import "./ConstruMarketRefined.css";

type House = {
  name: string;
  area: string;
  rooms: string;
  style: string;
  price: string;
  image: string;
  accent: string;
};

const houses: House[] = [
  { name: "Casa Bruma", area: "148 m²", rooms: "3 habitaciones", style: "Tropical", price: "$118k – $168k", image: "/__mockup/images/construmarket-refined-bruma.jpg", accent: "#c96245" },
  { name: "Patio Norte", area: "192 m²", rooms: "4 habitaciones", style: "Contemporáneo", price: "$164k – $231k", image: "/__mockup/images/construmarket-refined-patio.jpg", accent: "#6d7d67" },
  { name: "Loma Clara", area: "96 m²", rooms: "2 habitaciones", style: "Esencial", price: "$76k – $109k", image: "/__mockup/images/construmarket-refined-loma.jpg", accent: "#c08a55" },
];

export default function ConstruMarketRefined() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeStyle, setActiveStyle] = useState("Todos");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => houses.filter((house) => {
    const matchesText = house.name.toLowerCase().includes(query.toLowerCase());
    const matchesStyle = activeStyle === "Todos" || house.style === activeStyle;
    return matchesText && matchesStyle;
  }), [query, activeStyle]);

  const toggleSaved = (name: string) => {
    setSaved((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
    setNotice(saved.includes(name) ? "Diseño quitado de guardados" : "Diseño guardado en tu colección");
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main className="cm-page">
      <div className="cm-grain" aria-hidden="true" />
      <header className="cm-nav">
        <a className="cm-brand" href="#inicio" aria-label="ConstruMarket CR inicio">
          <span className="cm-brand-mark"><Home size={17} strokeWidth={2.4} /></span>
          <span>Constru<span>Market</span><small>CR</small></span>
        </a>
        <nav className={`cm-nav-links ${menuOpen ? "is-open" : ""}`}>
          <a className="active" href="#catalogo">Diseños</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#profesionales">Para profesionales</a>
        </nav>
        <div className="cm-nav-actions">
          <button className="cm-text-button" onClick={() => setNotice("El acceso estará disponible en el lanzamiento.")}>Ingresar</button>
          <button className="cm-dark-button" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Explorar diseños <ArrowUpRight size={16} /></button>
          <button className="cm-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      <section className="cm-hero" id="inicio">
        <div className="cm-hero-copy">
          <div className="cm-eyebrow"><span className="cm-pulse" /> Diseño para vivir mejor</div>
          <h1>Tu casa empieza<br /><em>con una buena idea.</em></h1>
          <p>Planos listos para construir, costos transparentes y profesionales verificados. Todo lo que necesitas para pasar de imaginar a habitar.</p>
          <div className="cm-hero-cta">
            <button className="cm-coral-button" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Ver el catálogo <ArrowUpRight size={17} /></button>
            <span className="cm-note"><ShieldCheck size={16} /> Diseños revisados por CFIA</span>
          </div>
          <div className="cm-proof">
            <div className="cm-avatars"><span>MR</span><span>AL</span><span>JP</span><b>+2k</b></div>
            <p><strong>2,418</strong> personas ya están<br />diseñando su próximo espacio.</p>
          </div>
        </div>
        <div className="cm-hero-art">
          <div className="cm-image-frame">
            <img src="/__mockup/images/construmarket-refined-hero.jpg" alt="Casa tropical contemporánea en Costa Rica" />
          </div>
          <div className="cm-floating-card cm-location"><Compass size={16} /><span>Diseñado para<br /><strong>Costa Rica</strong></span></div>
          <div className="cm-floating-card cm-stamp"><Sparkles size={15} /><span>Presupuesto<br /><strong>sin sorpresas</strong></span></div>
          <span className="cm-hero-number">01 <i>/ 03</i></span>
        </div>
      </section>

      <section className="cm-trust" id="como-funciona">
        <span>Una forma más clara de construir</span>
        <div className="cm-trust-items"><span><ShieldCheck size={15} /> Profesionales verificados</span><span><Check size={15} /> Costos de obra realistas</span><span><Ruler size={15} /> Planos listos para tramitar</span></div>
      </section>

      <section className="cm-catalog" id="catalogo">
        <div className="cm-section-heading">
          <div><div className="cm-eyebrow">Elige tu punto de partida</div><h2>Diseños que <em>se sienten tuyos.</em></h2></div>
          <p>Explora una colección curada de proyectos pensados para nuestro clima, nuestra luz y nuestra forma de vivir.</p>
        </div>
        <div className="cm-filter-row">
          <div className="cm-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un diseño..." /></div>
          <div className="cm-filters">{["Todos", "Tropical", "Contemporáneo", "Esencial"].map((style) => <button key={style} className={activeStyle === style ? "selected" : ""} onClick={() => setActiveStyle(style)}>{style}</button>)}</div>
          <button className="cm-sort"><span>Más populares</span><ChevronDown size={15} /></button>
        </div>
        <div className="cm-house-grid">
          {filtered.map((house) => <article className="cm-house-card" key={house.name}>
            <div className="cm-house-image"><img src={house.image} alt={house.name} /><span className="cm-style-tag" style={{ backgroundColor: house.accent }}>{house.style}</span><button className={`cm-save ${saved.includes(house.name) ? "saved" : ""}`} onClick={() => toggleSaved(house.name)} aria-label={`Guardar ${house.name}`}><Bookmark size={17} fill={saved.includes(house.name) ? "currentColor" : "none"} /></button></div>
            <div className="cm-house-content"><div className="cm-house-top"><div><h3>{house.name}</h3><p>Planos listos para construir</p></div><ArrowUpRight size={18} /></div><div className="cm-house-specs"><span><Ruler size={15} />{house.area}</span><span><BedDouble size={15} />{house.rooms}</span></div><div className="cm-house-price"><small>Construcción estimada</small><strong>{house.price}</strong></div></div>
          </article>)}
        </div>
        {filtered.length === 0 && <div className="cm-empty">No encontramos diseños con esa búsqueda.</div>}
        <button className="cm-outline-button" onClick={() => { setQuery(""); setActiveStyle("Todos"); setNotice("Mostrando todos los diseños"); }}>Ver todos los diseños <ArrowUpRight size={16} /></button>
      </section>

      <section className="cm-professional" id="profesionales"><div><div className="cm-eyebrow">Para arquitectos e ingenieros</div><h2>Tu próximo proyecto<br /><em>merece encontrar su gente.</em></h2></div><div><p>Publica tus diseños, llega a clientes que ya están listos para construir y convierte tu trabajo en nuevas oportunidades.</p><button className="cm-light-button" onClick={() => setNotice("Te avisaremos cuando abramos el registro profesional.")}>Quiero publicar <ArrowUpRight size={16} /></button></div></section>
      <footer className="cm-footer"><span className="cm-brand"><span className="cm-brand-mark"><Home size={16} /></span><span>Constru<span>Market</span><small>CR</small></span></span><span>Hecho para construir en Costa Rica <i>·</i> 2024</span><div><a href="#como-funciona">Cómo funciona</a><a href="#profesionales">Profesionales</a></div></footer>
      {notice && <div className="cm-toast"><Check size={16} />{notice}</div>}
    </main>
  );
}