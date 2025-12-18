import { SidebarProvider } from "~/components/ui/sidebar";

// Simple layout wrapper that provides a sidebar and header slots. The `sidebar`
// and `header` props are expected to be pre-built React nodes (so the caller can
// pass different sidebar configurations). This keeps layout composition flexible.


interface LayoutWithSideBarHeaderProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
}

export function LayoutWithSideBarHeader({ children, sidebar, header: header }: LayoutWithSideBarHeaderProps) {
  return (
    <SidebarProvider>
      <div className="bg-sidebar flex h-screen w-full">
        {sidebar}
        <div className="flex flex-1 flex-col w-full overflow-x-hidden md:mt-2 rounded-none lg:rounded-tl-xl bg-page-background">
          {header}
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}