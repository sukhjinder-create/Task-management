// src/components/BlogEditor.jsx
//
// The article form, shared by the workspace-admin authoring page and the Super
// Admin console. Both roles edit the same shape, so keeping one component is
// what stops a field being addable in one console and invisible in the other.
//
// The component is presentational: it owns the draft in local state and hands
// the whole payload back on save. Who may save, and what happens next, is the
// caller's business.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";

const CATEGORY_LABELS = {
  decision: "Decision intelligence",
  execution: "Enterprise execution",
  governance: "AI and governance",
};

// Every colour goes through the theme tokens in index.css. The app ships seven
// themes, so a literal gray-300 or amber-50 is not "the light variant" — it is
// a value that is wrong in six of them. The utility shim in index.css rescues
// bare .bg-gray-50 and .text-gray-700, but not borders, not opacity variants
// like bg-gray-50/60, and not the amber/emerald status panels, which is exactly
// how this editor ended up unreadable on the dark theme.
const T = {
  text: "text-[color:var(--text)]",
  muted: "text-[color:var(--text-muted)]",
  soft: "text-[color:var(--text-soft)]",
  border: "border-[color:var(--border)]",
  borderStrong: "border-[color:var(--border-strong)]",
  surface: "bg-[var(--surface)]",
  surfaceSoft: "bg-[var(--surface-soft)]",
  primary: "text-[color:var(--primary)]",
  hover: "hover:bg-[var(--surface-soft)]",
};

const inputClass =
  `mt-1 w-full rounded-[var(--radius-sm)] border ${T.borderStrong} ${T.surface} ${T.text} ` +
  "px-3 py-2 text-sm placeholder:text-[color:var(--text-soft)] " +
  "focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)] " +
  "transition-[border-color,box-shadow] duration-150";

const iconButtonClass =
  `rounded p-1 ${T.soft} hover:bg-[var(--surface-strong)] hover:text-[color:var(--text)] ` +
  "disabled:opacity-30 transition-colors";

const dangerIconButtonClass =
  `rounded p-1 ${T.soft} hover:bg-[var(--danger-bg)] hover:text-[color:var(--danger-text)] transition-colors`;

const linkButtonClass =
  `inline-flex items-center gap-1 text-xs font-medium ${T.primary} hover:text-[color:var(--primary-hover)]`;

const EMPTY_POST = {
  title: "",
  slug: "",
  short_title: "",
  dek: "",
  category: "execution",
  seo_title: "",
  seo_description: "",
  keywords: [],
  takeaways: ["", "", ""],
  sections: [{ title: "", paragraphs: [""], bullets: [] }],
  sources: [{ title: "", publisher: "", url: "" }],
  related: [],
  product_links: [],
  featured: false,
};

/** 180wpm, matching the server's derivation so the counter never disagrees. */
function readingMinutes(sections) {
  const words = (sections || []).reduce(
    (total, section) =>
      total +
      (section.paragraphs || []).join(" ").split(/\s+/).filter(Boolean).length +
      (section.bullets || []).join(" ").split(/\s+/).filter(Boolean).length,
    0
  );
  return { words, minutes: Math.max(1, Math.ceil(words / 180)) };
}

function Field({ label, hint, children, counter }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm font-medium ${T.muted}`}>{label}</span>
        {counter}
      </div>
      {children}
      {hint && <p className={`mt-1 text-xs ${T.soft}`}>{hint}</p>}
    </label>
  );
}

function CharCounter({ value, min, max }) {
  const length = (value || "").length;
  const ok = (!min || length >= min) && (!max || length <= max);
  return (
    <span
      className={`text-xs tabular-nums ${
        ok ? T.soft : "text-[color:var(--score-warning)]"
      }`}
    >
      {length}
      {max ? ` / ${max}` : ""}
    </span>
  );
}

/** Comma-separated list bound to a string[] field. */
function ListInput({ value, onChange, placeholder }) {
  return (
    <input
      className={inputClass}
      value={(value || []).join(", ")}
      placeholder={placeholder}
      onChange={(event) =>
        onChange(
          event.target.value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        )
      }
    />
  );
}

function SectionEditor({ section, index, total, onChange, onRemove, onMove }) {
  const [open, setOpen] = useState(true);

  const update = (patch) => onChange({ ...section, ...patch });

  return (
    <div className={`rounded-[var(--radius-md)] border ${T.border} ${T.surfaceSoft}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className={`h-4 w-4 shrink-0 ${T.soft}`} />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`flex-1 truncate text-left text-sm font-medium ${T.text}`}
        >
          {section.title || `Section ${index + 1}`}
        </button>
        <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}
          className={iconButtonClass} title="Move up">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1}
          className={iconButtonClass} title="Move down">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onRemove(index)}
          className={dangerIconButtonClass} title="Remove section">
          <Trash2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setOpen((value) => !value)}
          className={iconButtonClass} title={open ? "Collapse" : "Expand"}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className={`space-y-3 border-t ${T.border} p-3`}>
          <Field label="Heading">
            <input
              className={inputClass}
              value={section.title || ""}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="What this section argues"
            />
          </Field>

          <Field label="Paragraphs" hint="One paragraph per box. Empty boxes are dropped on save.">
            <div className="space-y-2">
              {(section.paragraphs || []).map((paragraph, paragraphIndex) => (
                <div key={paragraphIndex} className="flex gap-2">
                  <textarea
                    className={`${inputClass} min-h-[90px]`}
                    value={paragraph}
                    onChange={(event) => {
                      const paragraphs = [...section.paragraphs];
                      paragraphs[paragraphIndex] = event.target.value;
                      update({ paragraphs });
                    }}
                  />
                  <button
                    type="button"
                    className="self-start rounded p-1 text-[color:var(--text-soft)] hover:bg-[var(--danger-bg)] hover:text-[color:var(--danger-text)]"
                    onClick={() =>
                      update({ paragraphs: section.paragraphs.filter((_, i) => i !== paragraphIndex) })
                    }
                    title="Remove paragraph"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:text-[color:var(--primary-hover)]"
                onClick={() => update({ paragraphs: [...(section.paragraphs || []), ""] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add paragraph
              </button>
            </div>
          </Field>

          <Field label="Bullets" hint="Optional. Comma-separated.">
            <ListInput
              value={section.bullets}
              onChange={(bullets) => update({ bullets })}
              placeholder="Outcome: the result the organization wants, Decision: the material choice"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

export default function BlogEditor({
  post,
  onSave,
  saving = false,
  readOnly = false,
  readiness = [],
  actions = null,
}) {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_POST, ...(post || {}) }));

  useEffect(() => {
    setDraft({ ...EMPTY_POST, ...(post || {}) });
  }, [post?.id]);

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const { words, minutes } = useMemo(() => readingMinutes(draft.sections), [draft.sections]);

  const moveSection = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draft.sections.length) return;
    const sections = [...draft.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    set({ sections });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSave?.(draft);
      }}
    >
      <fieldset disabled={readOnly || saving} className="space-y-6">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" counter={<CharCounter value={draft.title} min={10} max={90} />}>
              <input
                className={inputClass}
                value={draft.title}
                onChange={(event) => set({ title: event.target.value })}
                placeholder="What is decision-to-outcome intelligence?"
                required
              />
            </Field>
          </div>

          <Field label="URL slug" hint="Leave blank to derive it from the title.">
            <input
              className={inputClass}
              value={draft.slug || ""}
              onChange={(event) => set({ slug: event.target.value })}
              placeholder="decision-to-outcome-intelligence"
            />
          </Field>

          <Field label="Category">
            <select
              className={inputClass}
              value={draft.category}
              onChange={(event) => set({ category: event.target.value })}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Standfirst (dek)" hint="The one-sentence summary shown under the headline.">
              <textarea
                className={`${inputClass} min-h-[70px]`}
                value={draft.dek || ""}
                onChange={(event) => set({ dek: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Short title" hint="Used in breadcrumbs. Defaults to the title.">
            <input
              className={inputClass}
              value={draft.short_title || ""}
              onChange={(event) => set({ short_title: event.target.value })}
            />
          </Field>

          <div className="flex items-end pb-1">
            <label className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[color:var(--border-strong)]"
                checked={Boolean(draft.featured)}
                onChange={(event) => set({ featured: event.target.checked })}
              />
              Feature at the top of /blog
            </label>
          </div>
        </div>

        {/* ── Search ───────────────────────────────────────────────── */}
        <div className="rounded-lg border border-[color:var(--border)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[color:var(--text)]">Search appearance</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SEO title" counter={<CharCounter value={draft.seo_title} max={70} />}>
              <input
                className={inputClass}
                value={draft.seo_title || ""}
                onChange={(event) => set({ seo_title: event.target.value })}
              />
            </Field>
            <Field label="Keywords" hint="Comma-separated.">
              <ListInput value={draft.keywords} onChange={(keywords) => set({ keywords })} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="SEO description"
                hint="Between 110 and 180 characters."
                counter={<CharCounter value={draft.seo_description} min={110} max={180} />}
              >
                <textarea
                  className={`${inputClass} min-h-[70px]`}
                  value={draft.seo_description || ""}
                  onChange={(event) => set({ seo_description: event.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Takeaways ────────────────────────────────────────────── */}
        <Field label="Key takeaways" hint="At least three.">
          <div className="mt-1 space-y-2">
            {(draft.takeaways || []).map((takeaway, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className={inputClass}
                  value={takeaway}
                  onChange={(event) => {
                    const takeaways = [...draft.takeaways];
                    takeaways[index] = event.target.value;
                    set({ takeaways });
                  }}
                />
                <button
                  type="button"
                  className="rounded p-1 text-[color:var(--text-soft)] hover:bg-[var(--danger-bg)] hover:text-[color:var(--danger-text)]"
                  onClick={() => set({ takeaways: draft.takeaways.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:text-[color:var(--primary-hover)]"
              onClick={() => set({ takeaways: [...(draft.takeaways || []), ""] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add takeaway
            </button>
          </div>
        </Field>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-[color:var(--text)]">Article body</h3>
            <span className="text-xs text-[color:var(--text-soft)] tabular-nums">
              {words} words &middot; {minutes} min read
            </span>
          </div>
          <div className="space-y-3">
            {(draft.sections || []).map((section, index) => (
              <SectionEditor
                key={index}
                section={section}
                index={index}
                total={draft.sections.length}
                onMove={moveSection}
                onChange={(updated) => {
                  const sections = [...draft.sections];
                  sections[index] = updated;
                  set({ sections });
                }}
                onRemove={(removeIndex) =>
                  set({ sections: draft.sections.filter((_, i) => i !== removeIndex) })
                }
              />
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[color:var(--border-strong)] px-3 py-2 text-xs font-medium text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
              onClick={() =>
                set({ sections: [...(draft.sections || []), { title: "", paragraphs: [""], bullets: [] }] })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add section
            </button>
          </div>
        </div>

        {/* ── Sources ──────────────────────────────────────────────── */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--text)]">Sources</h3>
          <p className="mb-2 text-xs text-[color:var(--text-soft)]">
            At least one. URLs must be HTTPS or they are dropped on save.
          </p>
          <div className="space-y-2">
            {(draft.sources || []).map((source, index) => (
              <div key={index} className="flex gap-2">
                <input className={inputClass} placeholder="Title" value={source.title || ""}
                  onChange={(event) => {
                    const sources = [...draft.sources];
                    sources[index] = { ...source, title: event.target.value };
                    set({ sources });
                  }} />
                <input className={inputClass} placeholder="Publisher" value={source.publisher || ""}
                  onChange={(event) => {
                    const sources = [...draft.sources];
                    sources[index] = { ...source, publisher: event.target.value };
                    set({ sources });
                  }} />
                <input className={inputClass} placeholder="https://…" value={source.url || ""}
                  onChange={(event) => {
                    const sources = [...draft.sources];
                    sources[index] = { ...source, url: event.target.value };
                    set({ sources });
                  }} />
                <button type="button" className="rounded p-1 text-[color:var(--text-soft)] hover:bg-[var(--danger-bg)] hover:text-[color:var(--danger-text)]"
                  onClick={() => set({ sources: draft.sources.filter((_, i) => i !== index) })}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:text-[color:var(--primary-hover)]"
              onClick={() => set({ sources: [...(draft.sources || []), { title: "", publisher: "", url: "" }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add source
            </button>
          </div>
        </div>

        {/* ── Cross-links ──────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Related article slugs" hint="Comma-separated slugs of other published posts.">
            <ListInput value={draft.related} onChange={(related) => set({ related })} />
          </Field>
          <Field label="Product links" hint="Comma-separated site paths, e.g. /features/work-management.">
            <ListInput value={draft.product_links} onChange={(product_links) => set({ product_links })} />
          </Field>
        </div>
      </fieldset>

      {/* ── Readiness ──────────────────────────────────────────────── */}
      {readiness.length > 0 ? (
        <div className="rounded-lg border border-[color:var(--score-warning-border)] bg-[var(--score-warning-bg)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--score-warning)]">
            <AlertTriangle className="h-4 w-4" /> Not ready to publish
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[color:var(--score-warning)]">
            {readiness.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      ) : (
        post?.id && (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--score-good-border)] bg-[var(--score-good-bg)] p-3 text-sm text-[color:var(--score-good)]">
            <CheckCircle2 className="h-4 w-4" /> Meets the publication standard.
          </div>
        )
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-contrast)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {actions}
        </div>
      )}
    </form>
  );
}

export { CATEGORY_LABELS };
