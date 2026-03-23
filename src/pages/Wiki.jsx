// src/pages/Wiki.jsx
// Full-featured Wiki/Docs with space sidebar + page tree + rich text editing
import { useState, useEffect, useRef } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";
import {
  BookOpen, Plus, ChevronRight, ChevronDown, Pencil, Trash2,
  Search, FileText, Save, X, Globe, Lock,
} from "lucide-react";

export default function Wiki() {
  const api = useApi();
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [pages, setPages] = useState([]);        // tree
  const [activePage, setActivePage] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newSpaceForm, setNewSpaceForm] = useState({ name: "", slug: "", icon: "📄" });
  const [newPageForm, setNewPageForm] = useState({ title: "", parent_id: "" });
  const [saving, setSaving] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    api.get("/wiki/spaces").then(r => {
      setSpaces(r.data || []);
      if (r.data?.length > 0 && !activeSpace) setActiveSpace(r.data[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeSpace) return;
    api.get(`/wiki/spaces/${activeSpace.id}/pages`).then(r => setPages(r.data || [])).catch(() => {});
  }, [activeSpace]);

  const loadPage = async (page) => {
    const r = await api.get(`/wiki/pages/${page.id}`).catch(() => null);
    if (r) { setActivePage(r.data); setEditContent(r.data.content || ""); setEditTitle(r.data.title); }
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      const r = await api.get(`/wiki/search?q=${encodeURIComponent(q)}`).catch(() => ({ data: [] }));
      setSearchResults(r.data || []);
    }, 300);
  };

  const createSpace = async () => {
    if (!newSpaceForm.name) return toast.error("Name required");
    try {
      const r = await api.post("/wiki/spaces", { ...newSpaceForm, slug: newSpaceForm.slug || newSpaceForm.name.toLowerCase().replace(/\s+/g, "-") });
      setSpaces(prev => [...prev, r.data]);
      setActiveSpace(r.data);
      setShowNewSpace(false);
      setNewSpaceForm({ name: "", slug: "", icon: "📄" });
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const createPage = async () => {
    if (!newPageForm.title || !activeSpace) return toast.error("Title required");
    try {
      const r = await api.post(`/wiki/spaces/${activeSpace.id}/pages`, newPageForm);
      const refreshed = await api.get(`/wiki/spaces/${activeSpace.id}/pages`);
      setPages(refreshed.data || []);
      setShowNewPage(false);
      setNewPageForm({ title: "", parent_id: "" });
      loadPage(r.data);
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const savePage = async () => {
    if (!activePage) return;
    setSaving(true);
    try {
      const r = await api.put(`/wiki/pages/${activePage.id}`, {
        title: editTitle,
        content: editContent,
        content_text: editContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      });
      setActivePage(r.data);
      setEditing(false);
      toast.success("Saved");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  const deletePage = async (pageId) => {
    if (!confirm("Delete this page?")) return;
    await api.delete(`/wiki/pages/${pageId}`).catch(() => {});
    if (activePage?.id === pageId) setActivePage(null);
    const refreshed = await api.get(`/wiki/spaces/${activeSpace.id}/pages`).catch(() => ({ data: [] }));
    setPages(refreshed.data || []);
    toast.success("Page deleted");
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* ── Left sidebar ─────────────────────────────────── */}
      <div className="w-64 border-r theme-border flex flex-col theme-surface">
        <div className="px-3 py-3 border-b theme-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 theme-text-muted" />
            <input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search wiki…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
            />
          </div>
        </div>

        {searchQuery ? (
          <div className="flex-1 overflow-y-auto p-2">
            {searchResults.map(r => (
              <button key={r.id} onClick={async () => { setSearchQuery(""); setSearchResults([]); loadPage(r); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-soft)] text-sm theme-text">
                <p className="font-medium truncate">{r.title}</p>
                <p className="text-xs theme-text-muted truncate">{r.space_name}</p>
                {r.excerpt && <p className="text-xs theme-text-muted mt-1 italic line-clamp-2">{r.excerpt}</p>}
              </button>
            ))}
            {searchResults.length === 0 && <p className="text-sm theme-text-muted px-3 py-4">No results found</p>}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Spaces */}
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-xs font-semibold theme-text-muted uppercase tracking-wider">Spaces</span>
              <button onClick={() => setShowNewSpace(true)} className="p-1 rounded hover:bg-[var(--surface-soft)] theme-text-muted">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showNewSpace && (
              <div className="mx-3 mb-2 p-3 bg-[var(--surface-soft)] rounded-lg space-y-2">
                <input value={newSpaceForm.icon} onChange={e => setNewSpaceForm(f => ({ ...f, icon: e.target.value }))} className="w-12 px-2 py-1 rounded border theme-border theme-surface text-sm text-center" />
                <input value={newSpaceForm.name} onChange={e => setNewSpaceForm(f => ({ ...f, name: e.target.value }))} placeholder="Space name" className="w-full px-2 py-1 rounded border theme-border theme-surface text-sm theme-text" />
                <div className="flex gap-1">
                  <button onClick={createSpace} className="flex-1 py-1 bg-indigo-600 text-white rounded text-xs">Create</button>
                  <button onClick={() => setShowNewSpace(false)} className="flex-1 py-1 border theme-border rounded text-xs theme-text">Cancel</button>
                </div>
              </div>
            )}

            {spaces.map(space => (
              <div key={space.id}>
                <button
                  onClick={() => setActiveSpace(space)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg mx-1 ${activeSpace?.id === space.id ? "bg-indigo-50 text-indigo-700" : "theme-text hover:bg-[var(--surface-soft)]"}`}
                >
                  <span>{space.icon}</span>
                  <span className="flex-1 truncate font-medium">{space.name}</span>
                  {space.is_private ? <Lock className="w-3 h-3 theme-text-muted" /> : null}
                </button>

                {activeSpace?.id === space.id && (
                  <div className="pl-4">
                    {showNewPage && (
                      <div className="mx-2 my-1 p-2 bg-[var(--surface-soft)] rounded-lg space-y-1">
                        <input value={newPageForm.title} onChange={e => setNewPageForm(f => ({ ...f, title: e.target.value }))} placeholder="Page title" className="w-full px-2 py-1 rounded border theme-border theme-surface text-sm theme-text" />
                        <div className="flex gap-1">
                          <button onClick={createPage} className="flex-1 py-1 bg-indigo-600 text-white rounded text-xs">Create</button>
                          <button onClick={() => setShowNewPage(false)} className="flex-1 py-1 border theme-border rounded text-xs theme-text">Cancel</button>
                        </div>
                      </div>
                    )}
                    <PageTreeNode pages={pages} depth={0} activePage={activePage} onSelect={loadPage} onDelete={deletePage} />
                    <button onClick={() => setShowNewPage(true)} className="flex items-center gap-1 px-2 py-1 text-xs theme-text-muted hover:theme-text">
                      <Plus className="w-3 h-3" /> New page
                    </button>
                  </div>
                )}
              </div>
            ))}

            {spaces.length === 0 && (
              <div className="px-4 py-6 text-center">
                <BookOpen className="w-8 h-8 mx-auto mb-2 theme-text-muted opacity-40" />
                <p className="text-sm theme-text-muted">No spaces yet</p>
                <button onClick={() => setShowNewSpace(true)} className="mt-2 text-xs text-indigo-600 hover:underline">Create your first space</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activePage ? (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {editing ? (
              <div className="space-y-4">
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-3xl font-bold theme-text bg-transparent border-b theme-border pb-2 outline-none"
                />
                <RichEditor value={editContent} onChange={setEditContent} />
                <div className="flex gap-2">
                  <button onClick={savePage} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                    <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 border theme-border rounded-lg text-sm theme-text flex items-center gap-1">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className="text-3xl font-bold theme-text">{activePage.title}</h1>
                    <p className="text-sm theme-text-muted mt-1">
                      Last edited by {activePage.updated_by_name || activePage.created_by_name} · {new Date(activePage.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(true)} className="p-2 border theme-border rounded-lg hover:bg-[var(--surface-soft)] theme-text">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deletePage(activePage.id)} className="p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {activePage.content ? (
                  <div
                    className="prose prose-sm max-w-none theme-text"
                    dangerouslySetInnerHTML={{ __html: activePage.content }}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 mx-auto theme-text-muted opacity-30 mb-3" />
                    <p className="theme-text-muted">This page is empty.</p>
                    <button onClick={() => setEditing(true)} className="mt-3 text-sm text-indigo-600 hover:underline">Start writing</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-indigo-300" />
              <h2 className="text-xl font-semibold theme-text mb-2">Team Wiki</h2>
              <p className="theme-text-muted text-sm mb-4">
                {spaces.length > 0
                  ? "Select a page from the sidebar or create a new one."
                  : "Create a space to start documenting your team's knowledge."}
              </p>
              {spaces.length > 0 && (
                <button onClick={() => setShowNewPage(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                  New Page
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageTreeNode({ pages, depth, activePage, onSelect, onDelete }) {
  return pages.map(page => (
    <PageNode key={page.id} page={page} depth={depth} activePage={activePage} onSelect={onSelect} onDelete={onDelete} />
  ));
}

function PageNode({ page, depth, activePage, onSelect, onDelete }) {
  const [open, setOpen] = useState(false);
  const hasChildren = page.children?.length > 0;

  return (
    <div>
      <div className={`flex items-center gap-1 group pr-2 rounded-lg ${activePage?.id === page.id ? "bg-indigo-50" : "hover:bg-[var(--surface-soft)]"}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}>
        <button onClick={() => setOpen(o => !o)} className={`p-0.5 ${hasChildren ? "theme-text-muted" : "opacity-0 pointer-events-none"}`}>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <button onClick={() => onSelect(page)} className={`flex-1 text-left py-1 text-sm truncate ${activePage?.id === page.id ? "text-indigo-700 font-medium" : "theme-text"}`}>
          {page.icon && <span className="mr-1">{page.icon}</span>}{page.title}
        </button>
        <button onClick={() => onDelete(page.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {open && hasChildren && (
        <PageTreeNode pages={page.children} depth={depth + 1} activePage={activePage} onSelect={onSelect} onDelete={onDelete} />
      )}
    </div>
  );
}

// Simple rich-text editor using contentEditable (no external dep required)
function RichEditor({ value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, []);

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    ref.current?.focus();
  };

  return (
    <div className="border theme-border rounded-xl overflow-hidden">
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b theme-border bg-[var(--surface-soft)]">
        {[
          ["Bold", "bold", "B"],
          ["Italic", "italic", "I"],
          ["Underline", "underline", "U"],
        ].map(([title, cmd, label]) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); exec(cmd); }}
            title={title} className="px-2 py-1 rounded hover:bg-[var(--border)] text-sm font-medium theme-text">{label}</button>
        ))}
        <button onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }} className="px-2 py-1 rounded hover:bg-[var(--border)] text-sm theme-text" title="Bullet list">• List</button>
        <button onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }} className="px-2 py-1 rounded hover:bg-[var(--border)] text-sm theme-text" title="Numbered list">1. List</button>
        <button onMouseDown={e => { e.preventDefault(); exec("formatBlock", "h2"); }} className="px-2 py-1 rounded hover:bg-[var(--border)] text-sm theme-text">H2</button>
        <button onMouseDown={e => { e.preventDefault(); exec("formatBlock", "h3"); }} className="px-2 py-1 rounded hover:bg-[var(--border)] text-sm theme-text">H3</button>
        <button onMouseDown={e => { e.preventDefault(); exec("formatBlock", "blockquote"); }} className="px-2 py-1 rounded hover:bg-[var(--border)] text-sm theme-text">Quote</button>
        <button onMouseDown={e => { e.preventDefault(); exec("removeFormat"); }} className="px-2 py-1 rounded hover:bg-[var(--border)] text-xs theme-text-muted">Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current.innerHTML)}
        className="min-h-64 p-4 theme-text text-sm outline-none prose prose-sm max-w-none"
        style={{ lineHeight: "1.7" }}
      />
    </div>
  );
}
