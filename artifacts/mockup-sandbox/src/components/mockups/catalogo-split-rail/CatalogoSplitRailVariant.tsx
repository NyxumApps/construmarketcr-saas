import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Bell,
  Building2,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

type Plan = {
  id: number;
  name: string;
  style: string;
  location: string;
  area: string;
  beds: number;
  baths: number;
  price: string;
  image: string;
  accent: string;
  featured?: boolean;
};

const plans: Plan[] = [
  {
    id: 1,
    name: "Casa Níspero",
    style: "Tropical contemporánea",
    location: "Santa Ana, San José",
    area: "168 m²",
    beds: 3,
    baths: 2.5,
    price: "$126k – $168k",
    image:
      "linear-gradient(135deg, #d8cdb8 0%, #eee8dc 48%, #9b8e79 49%, #c8bba5 100%)",
    accent: "#c45b3e",
    featured: true,
  },
  {
    id: 2,
    name: "Casa Guayacán",
    style: "Patio y sombra",
    location: "Escazú, San José",
    area: "142 m²",
    beds: 3,
    baths: 2,
    price: "$112k – $149k",
    image:
      "linear-gradient(145deg, #bbc9c0 0%, #edf0e9 44%, #738b78 45%, #b2c1b6 100%)",
    accent: "#557061",
  },
  {
    id: 3,
    name: "Casa Brisa",
    style: "Moderna costera",
    location: "Nosara, Guanacaste",
    area: "96 m²",
    beds: 2,
    baths: 2,
    price: "$82k – $108k",
    image:
      "linear-gradient(135deg, #d5c0a3 0%, #f1e8d7 46%, #bb845f 47%, #d4b99b 100%)",
    accent: "#b6734d",
  },
  {
    id: 4,
    name: "Casa Roble",
    style: "Ladera familiar",
    location: "Cartago",
    area: "204 m²",
    beds: 4,
    baths: 3,
    price: "$154k – $206k",
    image:
      "linear-gradient(140deg, #b5c2c5 0%, #e2e8e6 47%, #6d8382 48%, #afc0bf 100%)",
    accent: "#496c6d",
  },
];

export default function CatalogoSplitRailVariant() {
  const [style, setStyle] = useState("Todos");
  const [sort, setSort] = useState("Recomendados");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [notice, setNotice] = useState(false);

  const filteredPlans = useMemo(
    () =>
      plans.filter((plan) => style === "Todos" || plan.style.includes(style)),
    [style],
  );

  const toggleFavorite = (id: number) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favorite) => favorite !== id)
        : [...current, id],
    );
  };

  return (
    <main className="min-h-screen bg-[#f3f0e9] text-[#1e2926] selection:bg-[#d96443]/20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap');
        .cm-display { font-family: 'Outfit', sans-serif; }
        .cm-body { font-family: 'DM Sans', sans-serif; }
        .cm-noise { position: relative; }
        .cm-noise:after { content: ''; pointer-events:none; position:absolute; inset:0; opacity:.035; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"); }
        @keyframes cm-rise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .cm-rise { animation: cm-rise .55s ease-out both; }
        .cm-delay-1 { animation-delay:.08s; } .cm-delay-2 { animation-delay:.16s; } .cm-delay-3 { animation-delay:.24s; }
      `}</style>

      <header className="cm-body sticky top-0 z-20 border-b border-[#d9d6cd] bg-[#f3f0e9]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#193d36] text-[#f2e8d6]">
              <Building2 size={19} />
            </div>
            <div className="cm-display text-[17px] font-semibold tracking-tight">
              ConstruMarket<span className="text-[#d26043]">CR</span>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#69736e] md:flex">
            <span className="text-[#1e2926]">Catálogo</span>
            <span className="hover:text-[#1e2926]">Cómo funciona</span>
            <span className="hover:text-[#1e2926]">Profesionales</span>
          </nav>
          <div className="flex items-center gap-2">
            <button className="hidden h-9 items-center gap-2 rounded-full px-3 text-[#69736e] hover:bg-[#e9e5dc] md:flex" onClick={() => setNotice(true)}>
              <Bell size={17} />
              <span className="text-xs font-medium">Avisarme</span>
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#cfcfc4] text-[#1e2926] md:hidden" onClick={() => setMobileFilters(true)} aria-label="Abrir filtros">
              <Menu size={17} />
            </button>
            <button className="hidden rounded-full bg-[#d26043] px-4 py-2 text-xs font-semibold text-[#fff9f0] shadow-sm hover:bg-[#ba4f35] sm:block" onClick={() => setNotice(true)}>
              Ingresar
            </button>
          </div>
        </div>
      </header>

      <div className="cm-body mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[220px_1fr]">
        <aside className="hidden min-h-[calc(100vh-72px)] border-r border-[#d9d6cd] px-6 py-10 lg:block">
          <div className="sticky top-28">
            <p className="mb-7 text-[10px] font-bold uppercase tracking-[.18em] text-[#8b928d]">Explorar</p>
            <div className="mb-9 space-y-1">
              {["Todos", "Tropical", "Moderna", "Patio", "Ladera"].map((item) => (
                <button
                  key={item}
                  onClick={() => setStyle(item === "Todos" ? "Todos" : item)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] transition ${style === (item === "Todos" ? "Todos" : item) ? "bg-[#e5e1d6] font-semibold text-[#193d36]" : "text-[#69736e] hover:bg-[#ebe8df]"}`}
                >
                  {item === "Todos" ? "Todos los diseños" : item}
                  {style === (item === "Todos" ? "Todos" : item) && <Check size={15} />}
                </button>
              ))}
            </div>
            <div className="border-t border-[#d9d6cd] pt-7">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-[#8b928d]">Tu búsqueda</p>
              <div className="space-y-3 text-[12px] text-[#69736e]">
                <div className="flex items-center justify-between"><span>Área</span><span className="font-semibold text-[#1e2926]">80 – 220 m²</span></div>
                <div className="flex items-center justify-between"><span>Habitaciones</span><span className="font-semibold text-[#1e2926]">2 – 4</span></div>
                <div className="flex items-center justify-between"><span>Provincia</span><span className="font-semibold text-[#1e2926]">Todas</span></div>
              </div>
              <button className="mt-6 flex items-center gap-2 text-[12px] font-semibold text-[#d26043]" onClick={() => setNotice(true)}>
                <SlidersHorizontal size={14} /> Ajustar filtros
              </button>
            </div>
          </div>
        </aside>

        <section className="px-5 pb-16 pt-9 lg:px-12 lg:pt-12">
          <div className="cm-rise cm-noise relative overflow-hidden rounded-[22px] bg-[#193d36] px-6 py-8 text-[#f7f1e7] sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="relative z-10 max-w-[560px]">
              <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-[#d4a995]"><Sparkles size={14} /> Diseños para empezar bien</p>
              <h1 className="cm-display text-4xl font-semibold leading-[1.03] tracking-[-.04em] sm:text-5xl">Encuentre el plano que<br /><span className="text-[#e4a082]">se siente como hogar.</span></h1>
              <p className="mt-5 max-w-[440px] text-sm leading-6 text-[#c6d1c9]">Propuestas listas para construir, pensadas para el clima y la vida cotidiana de Costa Rica.</p>
              <div className="mt-7 flex max-w-[390px] items-center gap-2 rounded-xl bg-[#f7f1e7] p-1.5 text-[#69736e]">
                <Search size={16} className="ml-2" />
                <input className="min-w-0 flex-1 bg-transparent px-1 py-2 text-xs outline-none placeholder:text-[#9ba19c]" placeholder="Buscar por nombre o ubicación" />
                <button className="rounded-lg bg-[#d26043] px-4 py-2 text-xs font-semibold text-[#fff9f0]" onClick={() => setNotice(true)}>Buscar</button>
              </div>
            </div>
            <div className="absolute -right-10 -top-16 h-72 w-72 rounded-full border-[42px] border-[#d26043]/35 sm:h-96 sm:w-96" />
            <div className="absolute -bottom-36 right-12 h-80 w-80 rounded-full border border-[#f7f1e7]/15" />
          </div>

          <div className="cm-body cm-rise cm-delay-1 mt-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#8b928d]">Colección actual</p>
              <h2 className="cm-display text-3xl font-semibold tracking-[-.035em]">Diseños destacados</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#69736e]">
              <span className="hidden sm:inline">Ordenar por</span>
              <button className="flex items-center gap-3 rounded-lg border border-[#d5d2c9] bg-[#f8f5ef] px-3 py-2 font-semibold text-[#1e2926]" onClick={() => setSort(sort === "Recomendados" ? "Precio menor" : "Recomendados")}>
                {sort} <ChevronDown size={14} />
              </button>
            </div>
          </div>

          <div className="cm-rise cm-delay-2 mt-7 grid gap-4 xl:grid-cols-2">
            {filteredPlans.map((plan, index) => (
              <article key={plan.id} className={`group overflow-hidden rounded-2xl border border-[#dbd8cf] bg-[#f8f5ef] transition hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(42,48,43,.08)] ${plan.featured ? "xl:col-span-2 xl:flex" : "flex"}`}>
                <div className={`relative min-h-[196px] ${plan.featured ? "xl:min-h-[260px] xl:w-[48%]" : "w-[42%]"} shrink-0`} style={{ background: plan.image }}>
                  <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(145deg, transparent 35%, rgba(25,61,54,.55) 36%, transparent 57%)" }} />
                  <span className="absolute left-4 top-4 rounded-full bg-[#f8f5ef]/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-[#53625a]">{plan.style}</span>
                  <button className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#f8f5ef]/90 ${favorites.includes(plan.id) ? "text-[#d26043]" : "text-[#69736e]"}`} onClick={() => toggleFavorite(plan.id)} aria-label="Guardar diseño">
                    <Heart size={15} fill={favorites.includes(plan.id) ? "currentColor" : "none"} />
                  </button>
                  {plan.featured && <span className="absolute bottom-4 left-4 rounded-full bg-[#193d36] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-[#f7f1e7]">Recomendado</span>}
                </div>
                <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="cm-display text-xl font-semibold tracking-[-.025em]">{plan.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-[#7e8780]"><MapPin size={12} /> {plan.location}</p></div>
                      {plan.featured && <span className="hidden rounded-full bg-[#f0dfd6] px-2 py-1 text-[10px] font-semibold text-[#a94d36] sm:inline">Nuevo</span>}
                    </div>
                    <div className="mt-5 flex gap-4 border-y border-[#e1ded6] py-3 text-xs text-[#69736e]">
                      <span className="flex items-center gap-1.5"><Ruler size={14} /> {plan.area}</span><span className="flex items-center gap-1.5"><BedDouble size={14} /> {plan.beds}</span><span className="flex items-center gap-1.5"><Bath size={14} /> {plan.baths}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-[#929891]">Construcción estimada</p><p className="cm-display mt-1 text-lg font-semibold" style={{ color: plan.accent }}>{plan.price}</p></div><button className="flex items-center gap-1.5 rounded-lg bg-[#e7e3d9] px-3 py-2 text-xs font-semibold text-[#193d36] transition group-hover:bg-[#193d36] group-hover:text-[#f7f1e7]" onClick={() => setNotice(true)}>Ver detalles <ArrowRight size={14} /></button></div>
                </div>
              </article>
            ))}
          </div>

          {filteredPlans.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-[#cfcac0] p-12 text-center text-sm text-[#69736e]">No encontramos diseños con ese filtro.</div>}

          <div className="cm-rise cm-delay-3 mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#dedbd2] bg-[#e9e5dc] px-6 py-5 sm:flex-row sm:items-center">
            <div><p className="cm-display text-lg font-semibold">¿Tiene una idea en mente?</p><p className="mt-1 text-xs text-[#69736e]">Conectamos su proyecto con profesionales verificados por el CFIA.</p></div>
            <button className="flex items-center gap-2 rounded-lg bg-[#193d36] px-4 py-2.5 text-xs font-semibold text-[#f7f1e7]" onClick={() => setNotice(true)}>Quiero publicar <ArrowRight size={14} /></button>
          </div>
        </section>
      </div>

      {mobileFilters && <div className="fixed inset-0 z-40 bg-[#193d36]/30 lg:hidden" onClick={() => setMobileFilters(false)}><aside className="h-full w-[280px] bg-[#f8f5ef] p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><p className="cm-display text-xl font-semibold">Explorar</p><button onClick={() => setMobileFilters(false)}><X size={20} /></button></div><div className="mt-8 space-y-2">{["Todos", "Tropical", "Moderna", "Patio", "Ladera"].map((item) => <button key={item} onClick={() => { setStyle(item === "Todos" ? "Todos" : item); setMobileFilters(false); }} className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-[#e9e5dc]">{item}</button>)}</div></aside></div>}
      {notice && <div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 items-center gap-3 rounded-xl bg-[#193d36] px-4 py-3 text-sm text-[#f7f1e7] shadow-xl"><Check size={17} className="text-[#e4a082]" /><span>Listo. Le avisaremos cuando esta función esté disponible.</span><button className="ml-auto opacity-70 hover:opacity-100" onClick={() => setNotice(false)}><X size={16} /></button></div>}
    </main>
  );
}