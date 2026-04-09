import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock3, Database, Loader2, RefreshCw, Search, Shield, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../api";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "../components/ui";

const EMPTY_FORM = {
  title: "",
  content: "",
  tags: "",
  visibility: "workspace",
  isPinned: false,
};

const RESULT_FILTER_ORDER = ["navigation", "user", "task", "project", "chat", "wiki", "goal", "memory"];
const RESULT_FILTER_LABELS = {
  all: "All",
  navigation: "Modules",
  user: "People",
  task: "Tasks",
  project: "Projects",
  chat: "Chat",
  wiki: "Wiki",
  goal: "Goals",
  memory: "Memory",
};

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function createEmptyHistoryState() {
  return {
    loading: false,
    items: [],
    summary: {
      totalClicks: 0,
      uniqueQueries: 0,
      uniqueDestinations: 0,
      lastClickedAt: null,
    },
  };
}

function ResultBadge({ children }) {
  return (
    <Badge color="primary" variant="subtle">
      {children}
    </Badge>
  );
}

function ResultFilterChip({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--primary,#2563eb)] bg-[var(--primary-soft,#dbeafe)] text-[var(--primary,#2563eb)]"
          : "theme-border bg-[var(--surface-soft)] theme-text-muted hover:border-[var(--primary,#2563eb)] hover:text-[var(--primary,#2563eb)]"
      }`}
    >
      {label} ({count})
    </button>
  );
}

export default function WorkspaceSearchMemory() {
  const api = useApi();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bootLoading, setBootLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "memory" ? "memory" : "search");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState({ loading: false, results: [], counts: {} });
  const [activeResultFilter, setActiveResultFilter] = useState("all");
  const [historyState, setHistoryState] = useState(createEmptyHistoryState);
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  const [memoryEntries, setMemoryEntries] = useState([]);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryForm, setMemoryForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [savingMemory, setSavingMemory] = useState(false);

  const currentSearchHits = useMemo(
    () => (searchState.results || []).length,
    [searchState.results]
  );

  const searchResultCounts = useMemo(() => {
    return (searchState.results || []).reduce((counts, result) => {
      const key = result?.type || "navigation";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [searchState.results]);

  const availableResultFilters = useMemo(() => {
    const seen = new Set(Object.keys(searchResultCounts));
    const ordered = RESULT_FILTER_ORDER.filter((key) => seen.has(key));
    const remaining = [...seen].filter((key) => !RESULT_FILTER_ORDER.includes(key)).sort();
    return [...ordered, ...remaining];
  }, [searchResultCounts]);

  const filteredSearchResults = useMemo(() => {
    if (activeResultFilter === "all") return searchState.results || [];
    return (searchState.results || []).filter((result) => result.type === activeResultFilter);
  }, [activeResultFilter, searchState.results]);

  async function loadMemory(q = memoryQuery) {
    const res = await api.get("/operations/memory", { params: { q, limit: 30 } });
    setMemoryEntries(res.data?.entries || []);
  }

  async function loadSearchHistory({ silent = false } = {}) {
    if (!silent) {
      setHistoryState((prev) => ({ ...prev, loading: true }));
    }

    try {
      const res = await api.get("/operations/search/history", { params: { limit: 20 } });
      setHistoryState({
        loading: false,
        items: res.data?.history || [],
        summary: res.data?.summary || createEmptyHistoryState().summary,
      });
    } catch (error) {
      setHistoryState((prev) => ({ ...prev, loading: false }));
      if (!silent) {
        toast.error(error?.response?.data?.error || "Failed to load search history");
      }
    }
  }

  async function loadMemoryEntry(id) {
    const res = await api.get(`/operations/memory/${id}`);
    return res.data;
  }

  async function loadPage({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setBootLoading(true);

    try {
      await Promise.all([
        loadMemory(memoryQuery),
        loadSearchHistory({ silent: true }),
      ]);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to load workspace search and memory");
    } finally {
      setBootLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadMemory(memoryQuery).catch((error) => {
        toast.error(error?.response?.data?.error || "Failed to filter memory");
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [memoryQuery]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setActiveResultFilter("all");
      setSearchState({ loading: false, results: [], counts: {} });
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchState((prev) => ({ ...prev, loading: true }));
        const res = await api.get("/operations/search", { params: { q: term } });
        setSearchState({
          loading: false,
          results: res.data?.results || [],
          counts: res.data?.counts || {},
        });
      } catch (error) {
        setSearchState((prev) => ({ ...prev, loading: false }));
        toast.error(error?.response?.data?.error || "Unified search failed");
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (activeResultFilter === "all") return;
    if (!searchResultCounts[activeResultFilter]) {
      setActiveResultFilter("all");
    }
  }, [activeResultFilter, searchResultCounts]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", activeTab);
      if (editingId) next.set("entry", editingId);
      else next.delete("entry");
      return next;
    }, { replace: true });
  }, [activeTab, editingId, setSearchParams]);

  useEffect(() => {
    const entryId = searchParams.get("entry");
    if (!entryId) return;
    let isActive = true;

    const existing = memoryEntries.find((item) => String(item.id) === String(entryId));
    if (existing) {
      beginEdit(existing);
      return undefined;
    }

    loadMemoryEntry(entryId)
      .then((entry) => {
        if (isActive && entry) beginEdit(entry);
      })
      .catch((error) => {
        if (isActive) {
          toast.error(error?.response?.data?.error || "Failed to open memory entry");
        }
      });

    return () => {
      isActive = false;
    };
  }, [memoryEntries, searchParams]);

  function resetForm() {
    setEditingId(null);
    setMemoryForm(EMPTY_FORM);
  }

  function beginEdit(entry) {
    setActiveTab("memory");
    setEditingId(entry.id);
    setMemoryForm({
      title: entry.title || "",
      content: entry.content || "",
      tags: Array.isArray(entry.tags) ? entry.tags.join(", ") : "",
      visibility: entry.visibility || "workspace",
      isPinned: Boolean(entry.is_pinned),
    });
  }

  async function handleMemorySubmit(event) {
    event.preventDefault();
    try {
      setSavingMemory(true);
      const payload = {
        title: memoryForm.title.trim(),
        content: memoryForm.content.trim(),
        tags: parseTags(memoryForm.tags),
        visibility: memoryForm.visibility,
        isPinned: Boolean(memoryForm.isPinned),
      };

      if (!payload.title || !payload.content) {
        toast.error("Title and content are required");
        return;
      }

      if (editingId) {
        await api.put(`/operations/memory/${editingId}`, payload);
        toast.success("Memory entry updated");
      } else {
        await api.post("/operations/memory", payload);
        toast.success("Memory entry created");
      }

      resetForm();
      await loadMemory(memoryQuery);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to save memory entry");
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleMemoryDelete(id) {
    try {
      setSavingMemory(true);
      await api.delete(`/operations/memory/${id}`);
      toast.success("Memory entry deleted");
      if (String(editingId || "") === String(id)) resetForm();
      await loadMemory(memoryQuery);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete memory entry");
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleMemoryPatch(entry, patch) {
    try {
      setSavingMemory(true);
      await api.put(`/operations/memory/${entry.id}`, patch);
      toast.success("Memory entry updated");
      await loadMemory(memoryQuery);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to update memory entry");
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleSearchResultClick(result) {
    const path = result?.meta?.path;
    if (!path) {
      toast("No direct destination is configured for this result yet.");
      return;
    }

    try {
      await api.post("/operations/search/click", {
        query: searchQuery.trim(),
        result,
      });
      loadSearchHistory({ silent: true });
    } catch (error) {
      console.error("Search click tracking failed:", error);
    }

    navigate(path);
  }

  if (bootLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[320px] items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm theme-text-muted">Loading workspace search and memory...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="overflow-hidden rounded-[28px] border theme-border bg-[linear-gradient(135deg,rgba(2,132,199,0.12),rgba(15,23,42,0.04),rgba(16,185,129,0.08))]">
        <div className="flex flex-col gap-6 px-6 py-8 md:flex-row md:items-end md:justify-between md:px-8">
          <div className="max-w-3xl">
            <Badge color="primary" size="md" variant="subtle">
              <Shield size={14} />
              Admin Feature
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight theme-text md:text-4xl">
              Workspace Search + Memory
            </h1>
            <p className="mt-3 text-sm leading-6 theme-text-muted">
              Search workspace modules, AI surfaces, users, tasks, chat, wiki, goals, and shared memory, then open the exact destination in one click.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />} onClick={() => loadPage({ silent: true })} disabled={refreshing}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => setShowSearchHistory((prev) => !prev)} className="text-left">
          <Card className="transition-colors hover:border-[var(--primary,#2563eb)]">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">Search Hits</p>
              <p className="mt-2 text-3xl font-semibold theme-text">{historyState.summary.totalClicks}</p>
              <p className="mt-2 text-sm theme-text-muted">
                {historyState.summary.uniqueQueries} unique queries
                {historyState.summary.lastClickedAt ? ` - Last ${formatDateTime(historyState.summary.lastClickedAt)}` : ""}
              </p>
              <p className="mt-1 text-xs theme-text-muted">{historyState.summary.uniqueDestinations} unique destinations opened</p>
              <p className="mt-2 text-xs font-medium text-[var(--primary,#2563eb)]">Click to view opened result history</p>
            </CardContent>
          </Card>
        </button>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">Memory Entries</p><p className="mt-2 text-3xl font-semibold theme-text">{memoryEntries.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">Access Model</p><p className="mt-2 text-lg font-semibold theme-text">Admin + Plan</p><p className="mt-2 text-sm theme-text-muted">Locked on both frontend and backend.</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={activeTab === "search" ? "primary" : "secondary"} leftIcon={<Search size={16} />} onClick={() => setActiveTab("search")}>
          Unified Search
        </Button>
        <Button variant={activeTab === "memory" ? "primary" : "secondary"} leftIcon={<Database size={16} />} onClick={() => setActiveTab("memory")}>
          Workspace Memory
        </Button>
      </div>

      {activeTab === "search" ? (
        <Card>
          <CardHeader>
            <CardTitle>Unified Search</CardTitle>
            <CardDescription>
              Admin-only workspace search across modules, tabs, records, and shared memory with one-click navigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search modules, AI tools, users, tasks, chat, wiki, goals, or memory..."
              leftIcon={<Search size={16} />}
            />

            {searchQuery.trim().length >= 2 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <ResultFilterChip
                    active={activeResultFilter === "all"}
                    label={RESULT_FILTER_LABELS.all}
                    count={currentSearchHits}
                    onClick={() => setActiveResultFilter("all")}
                  />
                  {availableResultFilters.map((key) => (
                    <ResultFilterChip
                      key={key}
                      active={activeResultFilter === key}
                      label={RESULT_FILTER_LABELS[key] || key}
                      count={searchResultCounts[key] || 0}
                      onClick={() => setActiveResultFilter(key)}
                    />
                  ))}
                </div>
                {currentSearchHits > 0 ? (
                  <p className="text-xs theme-text-muted">
                    {activeResultFilter === "all"
                      ? "Showing all matching search results."
                      : `Showing only ${(RESULT_FILTER_LABELS[activeResultFilter] || activeResultFilter).toLowerCase()} results.`}
                  </p>
                ) : null}
              </div>
            ) : null}

            {showSearchHistory ? (
              <div className="rounded-2xl border theme-border p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold theme-text">Recent Search History</p>
                    <p className="text-xs theme-text-muted">
                      Only clicked search results are stored here.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw size={14} className={historyState.loading ? "animate-spin" : ""} />}
                    onClick={() => loadSearchHistory()}
                    disabled={historyState.loading}
                  >
                    Refresh
                  </Button>
                </div>

                {historyState.loading ? (
                  <div className="flex items-center gap-2 text-sm theme-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading search history...
                  </div>
                ) : null}

                {!historyState.loading && historyState.items.length === 0 ? (
                  <p className="text-sm theme-text-muted">No clicked search results recorded yet.</p>
                ) : null}

                {historyState.items.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      if (!entry.path) {
                        toast("This history item no longer has a direct destination.");
                        return;
                      }
                      navigate(entry.path);
                    }}
                    className="block w-full rounded-xl border theme-border p-4 text-left transition-colors hover:bg-[var(--surface-soft)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ResultBadge>{entry.resultType}</ResultBadge>
                          <p className="text-sm font-semibold theme-text truncate">{entry.resultTitle}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs theme-text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={12} />
                            {formatDateTime(entry.clickedAt)}
                          </span>
                          <span>Query: {entry.query || "Unknown"}</span>
                        </div>
                        {entry.path ? <p className="mt-2 text-xs theme-text-muted truncate">{entry.path}</p> : null}
                      </div>
                      <Sparkles size={16} className="shrink-0 theme-text-muted" />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {searchState.loading ? (
              <div className="flex items-center gap-2 text-sm theme-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching workspace...
              </div>
            ) : null}

            {filteredSearchResults.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => handleSearchResultClick(result)}
                className="block w-full rounded-2xl border theme-border p-4 text-left transition-colors hover:bg-[var(--surface-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ResultBadge>{result.type}</ResultBadge>
                      <p className="text-sm font-semibold theme-text">{result.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 theme-text-muted">{result.snippet}</p>
                  </div>
                  <Sparkles size={16} className="shrink-0 theme-text-muted" />
                </div>
              </button>
            ))}

            {!searchState.loading && searchQuery.trim().length >= 2 && !searchState.results.length ? (
              <p className="text-sm theme-text-muted">No matching workspace modules or records found.</p>
            ) : null}

            {!searchState.loading && searchState.results.length > 0 && !filteredSearchResults.length ? (
              <p className="text-sm theme-text-muted">
                No {(RESULT_FILTER_LABELS[activeResultFilter] || activeResultFilter).toLowerCase()} results match this query.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "memory" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Memory Entry" : "Create Memory Entry"}</CardTitle>
              <CardDescription>
                Capture durable workspace knowledge that stays searchable for admins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleMemorySubmit}>
                <Input label="Title" value={memoryForm.title} onChange={(event) => setMemoryForm((prev) => ({ ...prev, title: event.target.value }))} />
                <Textarea label="Content" rows={8} value={memoryForm.content} onChange={(event) => setMemoryForm((prev) => ({ ...prev, content: event.target.value }))} />
                <Input label="Tags" value={memoryForm.tags} onChange={(event) => setMemoryForm((prev) => ({ ...prev, tags: event.target.value }))} helperText="Comma-separated tags" />
                <div className="grid gap-4 md:grid-cols-2">
                  <select value={memoryForm.visibility} onChange={(event) => setMemoryForm((prev) => ({ ...prev, visibility: event.target.value }))} className="rounded-lg border theme-border bg-transparent px-3 py-2 text-sm theme-text">
                    <option value="workspace">workspace</option>
                    <option value="private">private</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-sm theme-text md:mt-2">
                    <input type="checkbox" checked={Boolean(memoryForm.isPinned)} onChange={(event) => setMemoryForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
                    Pin this entry
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={savingMemory}>{editingId ? "Update Entry" : "Create Entry"}</Button>
                  {editingId ? (
                    <Button type="button" variant="secondary" onClick={resetForm}>Cancel Edit</Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Stored Memory</CardTitle>
                  <CardDescription>
                    Search, pin, archive, and reopen saved workspace knowledge.
                  </CardDescription>
                </div>
                <div className="w-full md:w-72">
                  <Input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Filter memory..." leftIcon={<Search size={16} />} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {memoryEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border theme-border p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {entry.is_pinned ? <Badge color="primary">Pinned</Badge> : null}
                        <Badge color="neutral">{entry.visibility}</Badge>
                        {entry.is_archived ? <Badge color="warning">Archived</Badge> : null}
                      </div>
                      <div>
                        <p className="text-base font-semibold theme-text">{entry.title}</p>
                        <p className="mt-2 text-sm leading-6 theme-text-muted">{entry.content}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(entry.tags || []).map((tag) => (
                          <Badge key={tag} color="neutral" variant="subtle">{tag}</Badge>
                        ))}
                      </div>
                      <p className="text-xs theme-text-muted">{entry.created_by_name || "Unknown"} • Updated {formatDateTime(entry.updated_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => beginEdit(entry)}>Edit</Button>
                      <Button size="sm" variant="secondary" loading={savingMemory} onClick={() => handleMemoryPatch(entry, { isPinned: !entry.is_pinned })}>
                        {entry.is_pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button size="sm" variant="secondary" loading={savingMemory} onClick={() => handleMemoryPatch(entry, { isArchived: !entry.is_archived })}>
                        {entry.is_archived ? "Restore" : "Archive"}
                      </Button>
                      <Button size="sm" variant="danger" loading={savingMemory} onClick={() => handleMemoryDelete(entry.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
              {!memoryEntries.length ? <p className="text-sm theme-text-muted">No memory entries yet.</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
