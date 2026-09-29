import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Home,
  Inbox,
  LayoutGrid,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import "./construMarketReviewQueue.css";

type ReviewItem = {
  id: number;
  kind: "Diseño" | "Profesional";
  title: string;
  subtitle: string;
  initials: string;
  tone: string;
  age: string;
  urgent?: boolean;
  meta: string;
};

const initialQueue: ReviewItem[] = [
  { id: 1, kind: "Diseño", title: "Casa Patio Central", subtitle: "María Fernanda Solís", initials: "MS", tone: "#de987e", age: "hace 18 min", urgent: true, meta: "3 dormitorios · 142 m² · Alajuela" },
  { id: 2, kind: "Profesional", title: "Validación CFIA", subtitle: "Andrés Quesada Vega", initials: "AQ", tone: "#88a6a0", age: "hace 42 min", meta: "Arquitecto · San José" },
  { id: 3, kind: "Diseño", title: "Loma Clara", subtitle: "Estudio Norte", initials: "EN", tone: "#c4a46c", age: "hace 1 h", meta: "2 dormitorios · 96 m² · Heredia" },
  { id: 4, kind: "Diseño", title: "Casa Brisa", subtitle: "Natalia Rojas", initials: "NR", tone: "#9a9cb8", age: "ayer", meta: "4 dormitorios · 188 m² · Cartago" },
  { id: 5, kind: "Profesional", title: "Validación CFIA", subtitle: "Sofía Campos", initials: "SC", tone: "#a0ad78", age: "ayer", meta: "Ingeniera civil · Guanacaste" },
];

export function ConstruMarketReviewQueue() {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedId, setSelectedId] = useState(1);
  const [filter, setFilter] = useState<"Todos" | "Diseños" | "Profesionales">("Todos");
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [resolved, setResolved] = useState<number[]>([]);
  const [toast, setToast] = useState("");

  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];
  const visibleQueue = useMemo(
    () => queue.filter((item) => filter === "Todos" || (filter === "Diseños" ? item.kind === "Diseño" : item.kind === "Profesional")),
    [filter, queue],
  );

  const resolve = (status: "approved" | "rejected") => {
    if (!selected) return;
    setResolved((old) => [...old, selected.id]);
    setToast(status === "approved" ? "Publicado en el catálogo" : "Devuelto al remitente");
    const remaining = queue.filter((item) => item.id !== selected.id);
    setQueue(remaining);
    setSelectedId(remaining[0]?.id ?? 0);
    window.setTimeout(() => setToast(""), 2200);
  };

  return (
    <div className="cm-shell">
      <aside className="cm-rail">
        <div className="cm-mark"><span>CM</span></div>
        <nav>
          <button className="cm-rail-btn active" aria-label="Revisión"><Inbox size={19} /><i /></button>
          <button className="cm-rail-btn" aria-label="Catálogo"><Home size={19} /></button>
          <button className="cm-rail-btn" aria-label="Profesionales"><UserRound size={19} /></button>
          <button className="cm-rail-btn" aria-label="Métricas"><LayoutGrid size={19} /></button>
        </nav>
        <button className="cm-rail-btn cm-rail-bottom" aria-label="Configuración"><SlidersHorizontal size={19} /></button>
      </aside>

      <section className="cm-sidebar">
        <div className="cm-side-top">
          <div className="cm-brand"><span className="cm-dot" /> ConstruMarket <em>CR</em></div>
          <button className="cm-icon-btn"><Menu size={18} /></button>
        </div>
        <div className="cm-workspace-label">Espacio de trabajo</div>
        <button className="cm-workspace"><span className="cm-avatar admin">AG</span><span><strong>Administración</strong><small>Revisión de catálogo</small></span><ChevronDown size={15} /></button>
        <div className="cm-side-section">
          <div className="cm-section-head"><span>Bandeja de entrada</span><span className="cm-count">5</span></div>
          <button className="cm-side-link selected"><ClipboardCheck size={16} /> Cola de revisión <b>5</b></button>
          <button className="cm-side-link"><MessageSquare size={16} /> Consultas <b className="muted-count">2</b></button>
        </div>
        <div className="cm-side-section cm-side-footer-note">
          <div className="cm-section-head"><span>Estado del sistema</span><span className="cm-live">● En línea</span></div>
          <div className="cm-health"><span /><div><strong>Todo funcionando</strong><small>Última sincronización hace 2 min</small></div></div>
        </div>
        <div className="cm-side-user"><span className="cm-avatar admin">AG</span><div><strong>Admin General</strong><small>admin@construmarket.cr</small></div><MoreHorizontal size={17} /></div>
      </section>

      <main className="cm-main">
        <header className="cm-header">
          <div><div className="cm-breadcrumb">Administración <span>/</span> Bandeja de entrada</div><h1>Cola de revisión</h1></div>
          <div className="cm-header-actions"><button className="cm-icon-btn"><Search size={18} /></button><button className="cm-icon-btn has-dot"><Bell size={18} /></button><button className="cm-help">?</button></div>
        </header>
        <div className="cm-toolbar">
          <div className="cm-tabs">{(["Todos", "Diseños", "Profesionales"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}{item === "Todos" && <span>5</span>}</button>)}</div>
          <button className="cm-filter"><SlidersHorizontal size={15} /> Más filtros</button>
        </div>
        <div className="cm-content">
          <div className="cm-queue">
            <div className="cm-queue-intro"><span>PRÓXIMAS REVISIÓNES</span><button><MoreHorizontal size={17} /></button></div>
            {visibleQueue.length === 0 && <div className="cm-empty">No hay solicitudes aquí.</div>}
            {visibleQueue.map((item) => (
              <button key={item.id} onClick={() => { setSelectedId(item.id); setShowNote(false); }} className={`cm-queue-item ${selected?.id === item.id ? "selected" : ""}`}>
                <span className="cm-avatar" style={{ background: item.tone }}>{item.initials}</span>
                <span className="cm-queue-copy"><strong>{item.title}</strong><small>{item.subtitle}</small><small className="cm-item-meta">{item.kind} · {item.age}</small></span>
                {item.urgent && <span className="cm-urgent">Prioridad</span>}
              </button>
            ))}
            <div className="cm-queue-bottom"><Sparkles size={15} /><span>La cola se ordena por prioridad y antigüedad.</span></div>
          </div>

          {selected ? <div className="cm-detail">
            <div className="cm-detail-top"><div><span className="cm-eyebrow">{selected.kind} · SOLICITUD #{String(selected.id).padStart(4, "0")}</span><h2>{selected.title}</h2><p>Enviada por <strong>{selected.subtitle}</strong> · {selected.age}</p></div><button className="cm-outline"><MoreHorizontal size={17} /> Acciones</button></div>
            <div className="cm-preview">
              <div className="cm-plan-art">
                <div className="cm-plan-label">VISTA PREVIA DEL PLANO</div>
                <div className="cm-house"><span className="room r1">SALA</span><span className="room r2">COMEDOR</span><span className="room r3">HAB.</span><span className="room r4">HAB.</span><span className="room r5">PATIO</span><span className="door d1" /><span className="door d2" /></div>
                <div className="cm-plan-stamp">CM<br /><small>REV 01</small></div>
              </div>
              <div className="cm-preview-caption"><div><strong>{selected.title}</strong><p>{selected.meta}</p></div><button className="cm-text-btn">Abrir archivo <span>↗</span></button></div>
            </div>
            <div className="cm-info-grid"><div><span>TIPO DE PROPIEDAD</span><strong>Vivienda unifamiliar</strong></div><div><span>PROVINCIA</span><strong>{selected.meta.split("·").pop()?.trim()}</strong></div><div><span>PRECIO DE REFERENCIA</span><strong>₡78.500.000</strong></div></div>
            <div className="cm-review-note"><div className="cm-note-icon"><FileText size={17} /></div><div><strong>Nota del remitente</strong><p>Diseño pensado para aprovechar la luz natural y los espacios de convivencia familiar.</p></div></div>
          </div> : <div className="cm-detail cm-empty-detail"><CircleAlert size={30} /><h2>Cola completada</h2><p>Has revisado todas las solicitudes pendientes.</p></div>}

          <aside className="cm-checklist">
            <div className="cm-check-head"><div><span className="cm-eyebrow">PASO 2 DE 3</span><h3>Verificación rápida</h3></div><span className="cm-progress">66%</span></div>
            <div className="cm-progress-line"><span /></div>
            <p className="cm-check-desc">Confirma que la información cumpla con los criterios antes de publicar.</p>
            {["Información completa", "Imágenes aptas para catálogo", "Profesional verificado"].map((label, i) => <div className="cm-check-row" key={label}><span className="cm-check" onClick={(event) => (event.currentTarget as HTMLSpanElement).classList.toggle("done")}>{i < 2 && <Check size={13} />}</span><span>{label}</span><button><MoreHorizontal size={14} /></button></div>)}
            <div className="cm-check-alert"><ShieldCheck size={16} /><span>Sin alertas detectadas en esta solicitud</span></div>
            <div className="cm-actions"><button className="cm-approve" onClick={() => resolve("approved")}><Check size={16} /> Aprobar y publicar</button><button className="cm-reject" onClick={() => resolve("rejected")}><X size={16} /> Devolver para cambios</button><button className="cm-add-note" onClick={() => setShowNote(!showNote)}><MessageSquare size={15} /> Añadir una nota</button>{showNote && <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe una nota para el remitente…" />}</div>
            <div className="cm-shortcut"><span>Atajos de teclado</span><kbd>A</kbd><small>Aprobar</small><kbd>R</kbd><small>Devolver</small></div>
          </aside>
        </div>
      </main>
      {toast && <div className="cm-toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

export default ConstruMarketReviewQueue;