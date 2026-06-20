import { Button } from "@/components/ui/button";
import type { HostKeyPromptPayload } from "@/lib/tauriCommands";
import { replyHostKey } from "@/lib/tauriCommands";

interface HostKeyDialogProps {
  prompt: HostKeyPromptPayload;
  onClose: () => void;
}

export default function HostKeyDialog({ prompt, onClose }: HostKeyDialogProps) {
  const handleAccept = async () => {
    await replyHostKey(prompt.prompt_id, true);
    onClose();
  };

  const handleReject = async () => {
    await replyHostKey(prompt.prompt_id, false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex flex-col w-[420px] bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl p-5 gap-4">
        <div>
          <span className="text-sm font-semibold text-[var(--warning)]">
            {prompt.changed ? "Host Key Changed!" : "Unknown Host Key"}
          </span>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">
          {prompt.changed
            ? "The host key for this server has changed. This could indicate a man-in-the-middle attack."
            : "The authenticity of this host cannot be established."}
        </p>

        <div className="flex flex-col gap-1.5 p-3 bg-[var(--background)] rounded-md">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Host</span>
            <span className="text-[var(--text)] font-mono">{prompt.host}:{prompt.port}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Key type</span>
            <span className="text-[var(--text)]">{prompt.key_type}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-[var(--text-secondary)]">Fingerprint</span>
            <span className="text-[var(--text)] font-mono break-all">{prompt.fingerprint}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
          <Button className="bg-[var(--primary)] text-[var(--background)] hover:brightness-110" onClick={handleAccept}>
            {prompt.changed ? "Accept Anyway" : "Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
