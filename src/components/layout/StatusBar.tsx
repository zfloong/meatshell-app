export default function StatusBar() {
  return (
    <footer className="flex h-7 items-center justify-between bg-[var(--surface-bright)] border-t border-[var(--border)] px-3 flex-shrink-0">
      <span className="text-xs text-[var(--text-secondary)]">
        Ready
      </span>
      <span className="text-xs text-[var(--text-secondary)]">
        {/* Right-side placeholder — connection duration, etc. */}
      </span>
    </footer>
  );
}
