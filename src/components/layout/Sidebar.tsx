import { PanelLeftOpen, PanelLeftClose, Activity, Zap } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function Sidebar() {
  const isOpen = useUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className="flex flex-col bg-[var(--surface)] border-r border-[var(--border)] overflow-hidden flex-shrink-0 transition-all duration-200 ease-in-out"
      style={{ width: isOpen ? 260 : 0 }}
    >
      {/* inner content stays visible; outer width collapses */}
      <div className="w-[260px] flex flex-col h-full">
        {/* header: title + collapse button */}
        <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Resources
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--text)]"
            onClick={toggleSidebar}
          >
            {isOpen ? (
              <PanelLeftClose size={16} />
            ) : (
              <PanelLeftOpen size={16} />
            )}
          </Button>
        </div>

        {/* tabs */}
        <Tabs defaultValue="monitor" className="flex flex-col flex-1 px-2 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="monitor" className="flex-1 gap-1.5">
              <Activity size={14} />
              <span>System Monitor</span>
            </TabsTrigger>
            <TabsTrigger value="commands" className="flex-1 gap-1.5">
              <Zap size={14} />
              <span>Quick Commands</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="monitor"
            className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]"
          >
            <p>Monitoring data will appear here</p>
          </TabsContent>

          <TabsContent
            value="commands"
            className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]"
          >
            <p>No saved commands</p>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
