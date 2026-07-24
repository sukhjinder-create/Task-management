// src/components/ShareToChat.jsx
//
// Reusable "Share to inbuilt chat" control.
//
// Drop <ShareToChat item={{ kind, title, subtitle, url }} /> anywhere (task
// detail, reports, etc.). It renders a small Share button that opens a picker
// of the channels + people the current user can reach, lets them multi-select,
// and posts the item into chat — reusing the EXACT existing chat pipeline
// (encryptForRecipients + POST /chat, the same recipe Chat.jsx uses), so it is
// fully additive and changes no existing flow. On success it shows a toast and
// closes; it never navigates away.
//
import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Share2, Hash, Lock, Search, Check, Send, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { encryptForRecipients, loadKeyPairFromStorage } from "../crypto/chatCrypto";

/* System/announcement channels that are auto-populated by the platform and
   should not be manual share targets (mirrors the backend, which hardcodes the
   same exclusion for unread counts in chat.service.js). */
const SYSTEM_CHANNEL_KEYS = new Set(["availability-updates"]);

/* Same DM key convention as Chat.jsx: sorted user ids. */
function dmKeyFor(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return `dm:${x}:${y}`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  } catch {
    return url;
  }
}

export default function ShareToChat({
  item,
  size = "sm",
  variant = "secondary",
  label = "Share",
  iconOnly = false,
  className,
  trigger, // optional: (openFn) => ReactNode — supply a custom trigger to match a toolbar
}) {
  // useAuth() exposes the session under `auth`; the user object is auth.user
  // (same access pattern as Chat.jsx). Destructuring `user` directly returns
  // undefined, which previously made myId empty (breaking DM keys + the guard).
  const { auth } = useAuth();
  const user = auth?.user;
  const api = useApi();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [channels, setChannels] = useState([]);
  const [people, setPeople] = useState([]);
  const [usersWithKeys, setUsersWithKeys] = useState([]);
  const [selected, setSelected] = useState({}); // id -> target descriptor
  const [query, setQuery] = useState("");

  const myId = user?.id != null ? String(user.id) : "";

  /* Load the shareable targets once, when the picker first opens. */
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [chRes, usersRes, keysRes] = await Promise.all([
          api.get("/chat/channels").catch(() => ({ data: [] })),
          api.get("/users").catch(() => ({ data: [] })),
          api.get("/crypto/public-keys").catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        const chans = (Array.isArray(chRes.data) ? chRes.data : []).filter(
          (c) =>
            c &&
            c.key &&
            !String(c.key).startsWith("dm:") &&
            !SYSTEM_CHANNEL_KEYS.has(String(c.key))
        );

        const ppl = (Array.isArray(usersRes.data) ? usersRes.data : []).filter(
          (u) => u && u.id != null && String(u.id) !== myId && !u.is_bot && !u.isAi
        );

        const keyed = (Array.isArray(keysRes.data) ? keysRes.data : []).map((row) => ({
          id: row.userId ?? row.id,
          username: row.username,
          publicKeyJwk: row.publicKey ?? row.public_key ?? row.publicKeyJwk ?? null,
        }));

        setChannels(chans);
        setPeople(ppl);
        setUsersWithKeys(keyed);
        setLoaded(true);
      } catch (err) {
        console.error("[ShareToChat] failed to load targets", err);
        toast.error("Could not load conversations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, loaded, api, myId]);

  /* Recipient ids for a channel key — mirrors Chat.jsx getRecipientIdsForChannelKey. */
  const recipientIdsFor = useCallback(
    (channelKey, members) => {
      const withPub = usersWithKeys.filter((u) => !!u.publicKeyJwk);
      const idsWithPub = new Set(withPub.map((u) => String(u.id)));
      const ensureSelf = (ids) => {
        const set = new Set((ids || []).map((id) => String(id)));
        if (myId) set.add(myId);
        return Array.from(set).filter((id) => idsWithPub.has(id));
      };
      if (channelKey && channelKey.startsWith("dm:")) {
        return ensureSelf(channelKey.split(":").slice(1));
      }
      if (Array.isArray(members) && members.length > 0) {
        return ensureSelf(members.map((m) => m.user_id || m.id));
      }
      return ensureSelf(withPub.map((u) => u.id));
    },
    [usersWithKeys, myId]
  );

  const toggle = useCallback((id, descriptor) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = descriptor;
      return next;
    });
  }, []);

  const selectedCount = Object.keys(selected).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (name) => !q || String(name || "").toLowerCase().includes(q);
    return {
      channels: channels.filter((c) => match(c.name || c.key)),
      people: people.filter((p) => match(p.username || p.name || p.email)),
    };
  }, [channels, people, query]);

  function close() {
    setOpen(false);
    setSelected({});
    setQuery("");
  }

  async function handleShare() {
    if (!selectedCount || sending) return;
    if (!myId) {
      toast.error("Please sign in again to share.");
      return;
    }

    const title = item?.title || "Untitled";
    const url = absoluteUrl(item?.url);
    // Optional distinct link label (e.g. a task's display id "ENG-142"); falls
    // back to the title so non-task items link on their title.
    const linkLabel = item?.linkLabel || title;
    const showTitleBeside = linkLabel !== title;

    // Match the platform's own "Copy link" output EXACTLY (ProjectTasks
    // handleCopyTaskLink): `<a href="url">LABEL</a> title`. No decorative
    // prefix — a shared item renders and behaves identically to a pasted link.
    const shareHtml = url
      ? `<a href="${escapeHtml(url)}">${escapeHtml(linkLabel)}</a>` +
        (showTitleBeside ? ` ${escapeHtml(title)}` : "")
      : `<strong>${escapeHtml(title)}</strong>`;

    // The chat renders fallbackText as HTML whenever a recipient can't decrypt
    // (e.g. no E2E keypair yet), so we keep the SAME link markup here — that way
    // the link is clickable for every recipient, exactly like a copied link.
    const fallbackText = shareHtml;

    const myPublicKeyJwk = loadKeyPairFromStorage()?.publicKeyJwk || null;
    const targets = Object.values(selected);

    setSending(true);
    try {
      const results = await Promise.allSettled(
        targets.map(async (t, i) => {
          const recipientIds = recipientIdsFor(t.channelKey, t.members);
          const encrypted = await encryptForRecipients(
            shareHtml,
            myId,
            recipientIds,
            usersWithKeys
          );
          return api.post("/chat/messages", {
            channelId: t.channelKey,
            encrypted,
            senderPublicKeyJwk: myPublicKeyJwk,
            fallbackText,
            tempId: `share-${Date.now()}-${i}`,
          });
        })
      );

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;

      if (ok > 0) {
        toast.success(
          ok === 1 ? "Shared to chat" : `Shared to ${ok} conversations`
        );
      }
      if (failed > 0 && ok === 0) {
        toast.error("Couldn't share. Please try again.");
      } else if (failed > 0) {
        toast.error(`${failed} couldn't be shared`);
      }

      if (ok > 0) close();
    } catch (err) {
      console.error("[ShareToChat] share failed", err);
      toast.error("Couldn't share. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const Row = ({ id, icon, name, hint, descriptor }) => {
    const isSel = !!selected[id];
    return (
      <button
        type="button"
        onClick={() => toggle(id, descriptor)}
        className={
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left transition-colors " +
          (isSel
            ? "bg-[var(--primary-soft)] border border-[color:var(--primary)]"
            : "border border-transparent hover:bg-[var(--surface-soft)]")
        }
      >
        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--surface-soft)] text-[color:var(--text-muted)]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-[color:var(--text)]">{name}</span>
          {hint ? (
            <span className="block truncate text-[11px] text-[color:var(--text-soft)]">{hint}</span>
          ) : null}
        </span>
        <span
          className={
            "shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-[5px] border " +
            (isSel
              ? "bg-[var(--primary)] border-[color:var(--primary)] text-[color:var(--primary-contrast)]"
              : "border-[color:var(--border-strong)]")
          }
          style={{ height: 18, width: 18 }}
        >
          {isSel ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      </button>
    );
  };

  const openPicker = useCallback((e) => {
    e?.stopPropagation?.();
    setOpen(true);
  }, []);

  return (
    <>
      {typeof trigger === "function" ? (
        trigger(openPicker)
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          leftIcon={<Share2 size={size === "xs" ? 13 : 14} />}
          onClick={openPicker}
          title="Share to chat"
        >
          {iconOnly ? null : label}
        </Button>
      )}

      <Modal isOpen={open} onClose={close} size="sm">
        <Modal.Header>
          <Modal.Title>Share to chat</Modal.Title>
          <button
            type="button"
            onClick={close}
            className="text-[color:var(--text-muted)] hover:text-[color:var(--text)] text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </Modal.Header>

        <Modal.Body className="!py-3">
          {item?.title ? (
            <div className="mb-3 rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]">
                {item?.kind || "item"}
              </div>
              <div className="truncate text-[13px] font-medium text-[color:var(--text)]">
                {item.title}
              </div>
            </div>
          ) : null}

          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels or people…"
              className="w-full h-9 pl-8 pr-3 rounded-[8px] bg-[var(--surface-soft)] border border-[color:var(--border)] text-[13px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)]"
            />
          </div>

          <div className="max-h-[46vh] overflow-y-auto -mx-1 px-1">
            {loading ? (
              <div className="py-8 text-center text-[12px] text-[color:var(--text-muted)]">
                Loading conversations…
              </div>
            ) : filtered.channels.length === 0 && filtered.people.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[color:var(--text-muted)]">
                No conversations found.
              </div>
            ) : (
              <>
                {filtered.channels.length > 0 && (
                  <>
                    <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-soft)]">
                      Channels
                    </div>
                    {filtered.channels.map((c) => {
                      const priv = c.is_private ?? c.isPrivate;
                      return (
                        <Row
                          key={"c:" + c.key}
                          id={"c:" + c.key}
                          icon={priv ? <Lock size={14} /> : <Hash size={14} />}
                          name={c.name || c.key}
                          descriptor={{
                            kind: "channel",
                            channelKey: c.key,
                            name: c.name || c.key,
                            members: c.members,
                          }}
                        />
                      );
                    })}
                  </>
                )}

                {filtered.people.length > 0 && (
                  <>
                    <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-soft)]">
                      People
                    </div>
                    {filtered.people.map((p) => (
                      <Row
                        key={"u:" + p.id}
                        id={"u:" + p.id}
                        icon={<UserIcon size={14} />}
                        name={p.username || p.name || p.email || "User"}
                        hint={p.username && p.email ? p.email : undefined}
                        descriptor={{
                          kind: "user",
                          channelKey: dmKeyFor(myId, p.id),
                          name: p.username || p.name || "User",
                        }}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <span className="mr-auto text-[12px] text-[color:var(--text-muted)]">
            {selectedCount ? `${selectedCount} selected` : "Select where to share"}
          </span>
          <Button variant="ghost" size="sm" onClick={close} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleShare}
            loading={sending}
            disabled={!selectedCount || sending}
            leftIcon={<Send size={14} />}
          >
            Share
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
