import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CredentialPromptPayload } from "@/lib/tauriCommands";
import { replyCredential } from "@/lib/tauriCommands";

interface CredentialDialogProps {
  prompt: CredentialPromptPayload;
  onClose: () => void;
}

export default function CredentialDialog({ prompt, onClose }: CredentialDialogProps) {
  const [user, setUser] = useState(prompt.user || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const handleSubmit = async () => {
    await replyCredential(
      prompt.prompt_id,
      prompt.need_user ? user || null : null,
      prompt.need_password ? password || null : null,
      remember,
    );
    onClose();
  };

  const handleCancel = async () => {
    await replyCredential(prompt.prompt_id, null, null, null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex flex-col w-[380px] bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl p-5 gap-4">
        <span className="text-sm font-semibold text-[var(--text)]">
          Login — {prompt.host}
        </span>

        <p className="text-xs text-[var(--text-secondary)]">
          Additional credentials are required to connect.
        </p>

        {prompt.need_user && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--text-secondary)]">Username</span>
            <Input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="h-8 text-sm bg-[var(--background)] border-[var(--border)]"
            />
          </label>
        )}

        {prompt.need_password && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--text-secondary)]">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 text-sm bg-[var(--background)] border-[var(--border)]"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Remember for this session
        </label>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="bg-[var(--primary)] text-[var(--background)] hover:brightness-110" onClick={handleSubmit}>
            Login
          </Button>
        </div>
      </div>
    </div>
  );
}
