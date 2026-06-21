import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type SessionConfig } from "@/lib/tauriCommands";

interface ConnectDialogProps {
  sessions: SessionConfig[];
  onClose: () => void;
  onConnect: (session: SessionConfig) => void;
  onSave: (session: SessionConfig) => void;
  onDelete: (id: string) => void;
}

function emptySession(): SessionConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    host: "",
    port: 22,
    user: "root",
    auth: "password",
    password: "",
    private_key_path: "",
    proxy: "",
    last_used: null,
    group: "",
    kind: "ssh",
  };
}

export default function ConnectDialog({
  sessions,
  onClose,
  onConnect,
  onSave,
  onDelete,
}: ConnectDialogProps) {
  const [form, setForm] = useState<SessionConfig>(emptySession());
  const [saving, setSaving] = useState(false);

  const isValid = form.host.trim().length > 0;

  const handleConnect = () => {
    if (!isValid) return;
    onConnect(form);
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      onSave(form);
      setForm(emptySession());
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSession = (s: SessionConfig) => {
    onConnect(s);
    onClose();
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    opts?: { type?: string; placeholder?: string },
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <Input
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={opts?.placeholder}
        className="h-8 text-sm"
      />
    </label>
  );

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex flex-col max-w-[800px] max-h-[80vh] p-0">
        <DialogHeader className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: saved sessions list */}
          <div className="w-[320px] border-r border-[var(--border-subtle)] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Saved Sessions
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {sessions.length === 0 ? (
                <div className="px-3 py-6 text-xs text-center text-[var(--text-muted)]">
                  No saved sessions
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer border-b border-[var(--border-subtle)]/50 group"
                    onClick={() => handleSelectSession(s)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--text-primary)] truncate">{s.name || s.host}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {s.user}@{s.host}:{s.port}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--color-danger)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(s.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: new session form */}
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
            {/* Row 1: name + kind */}
            <div className="grid grid-cols-2 gap-3">
              {field("Session Name", form.name, (v) => setForm({ ...form, name: v }), { placeholder: "My Server" })}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-secondary)]">Kind</span>
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as SessionConfig["kind"], port: e.target.value === "ssh" ? 22 : e.target.value === "telnet" ? 23 : 0 })}
                  className="h-8 text-sm bg-[#151c22] border-2 border-transparent rounded-sm px-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-[border-color,background]"
                >
                  <option value="ssh">SSH</option>
                  <option value="telnet">Telnet</option>
                  <option value="serial">Serial</option>
                </select>
              </label>
            </div>

            {/* Row 2: host + port */}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              {field("Host", form.host, (v) => setForm({ ...form, host: v }), { placeholder: "192.168.1.1" })}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-secondary)]">Port</span>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 22 })}
                  className="h-8 text-sm"
                />
              </label>
            </div>

            {/* Row 3: user + auth */}
            <div className="grid grid-cols-2 gap-3">
              {field("Username", form.user, (v) => setForm({ ...form, user: v }), { placeholder: "root" })}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-secondary)]">Auth</span>
                <select
                  value={form.auth}
                  onChange={(e) => setForm({ ...form, auth: e.target.value as SessionConfig["auth"] })}
                  className="h-8 text-sm bg-[#151c22] border-2 border-transparent rounded-sm px-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-[border-color,background]"
                >
                  <option value="password">Password</option>
                  <option value="key">Private Key</option>
                </select>
              </label>
            </div>

            {/* Password / key path */}
            <div className="grid grid-cols-2 gap-3">
              {form.auth === "password" ? (
                field("Password", form.password, (v) => setForm({ ...form, password: v }), { type: "password", placeholder: "••••••••" })
              ) : (
                field("Private Key Path", form.private_key_path, (v) => setForm({ ...form, private_key_path: v }), { placeholder: "~/.ssh/id_ed25519" })
              )}
              {field("Proxy (optional)", form.proxy, (v) => setForm({ ...form, proxy: v }), { placeholder: "socks5://127.0.0.1:1080" })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[var(--border-subtle)]">
              <Button
                variant="primary"
                className="flex-1 gap-1.5"
                onClick={handleConnect}
                disabled={!isValid}
              >
                <Plus size={14} />
                Connect
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={handleSave}
                disabled={!isValid || saving}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
