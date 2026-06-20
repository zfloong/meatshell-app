import TitleBar from "@/components/layout/TitleBar";
import Sidebar from "@/components/layout/Sidebar";
import ResizablePanel from "@/components/layout/ResizablePanel";
import StatusBar from "@/components/layout/StatusBar";

export default function App() {
  return (
    <div className="flex flex-col h-full w-full bg-[var(--background)]">
      {/* title bar */}
      <TitleBar />

      {/* body: sidebar + main area + bottom panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* sidebar */}
        <Sidebar />

        {/* right column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* terminal area */}
          <main className="flex-1 flex items-center justify-center bg-[var(--background)]">
            <span className="text-lg text-[var(--text-secondary)] select-none">
              Terminal Area
            </span>
          </main>

          {/* resizable bottom panel */}
          <ResizablePanel />
        </div>
      </div>

      {/* status bar */}
      <StatusBar />
    </div>
  );
}
