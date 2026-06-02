import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  LayoutGrid,
  ClipboardList,
  Target,
  PencilLine,
  LineChart,
  MessageSquare,
  CalendarDays,
  Megaphone,
  Download,
  UsersRound,
  Settings,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CareLogo } from "@/components/CareLogo";
import { useAuth } from "@/lib/auth-context";

type NavItem = {
  title: string;
  to?: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
  adminOnly?: boolean;
};

type NavSection = { label?: string; items: NavItem[] };

const NAV: NavSection[] = [
  { items: [{ title: "Dashboard", to: "/admin", icon: LayoutDashboard }] },
  {
    label: "Students",
    items: [
      { title: "Students", to: "/admin", icon: Users },
      { title: "Sections", to: "/admin", icon: LayoutGrid },
    ],
  },
  {
    label: "Clinical",
    items: [
      { title: "Assessments", to: "/admin", icon: ClipboardList },
      { title: "Interventions", to: "/admin", icon: Target },
      { title: "Daily Logs", to: "/admin", icon: PencilLine },
      { title: "Weekly Analysis", to: "/admin", icon: LineChart },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Parent Communication", to: "/admin", icon: MessageSquare },
      { title: "Meetings & Calls", icon: CalendarDays, soon: true },
      { title: "News & Announcements", icon: Megaphone, soon: true },
    ],
  },
  {
    label: "Reports",
    items: [{ title: "Reports", icon: Download, soon: true }],
  },
  {
    label: "System",
    items: [
      { title: "Users & Roles", icon: UsersRound, soon: true, adminOnly: true },
      { title: "Settings", icon: Settings, soon: true, adminOnly: true },
    ],
  },
];

function roleLabel(role: string | undefined): string {
  switch (role) {
    case "administrator":
      return "Administrator";
    case "psychologist":
      return "Psychologist";
    case "teacher":
      return "Teacher";
    case "speech_therapist":
      return "Speech Therapist";
    case "parent":
      return "Parent";
    default:
      return "User";
  }
}

function CareSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === "administrator";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/40 py-4">
        <div className="flex items-center gap-3 px-2">
          <div className="rounded-lg bg-white/95 p-1 shadow-sm shrink-0">
            <CareLogo size={collapsed ? 28 : 36} />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-heading font-bold text-sidebar-foreground text-sm">
                CARE System
              </p>
              <p className="text-[10px] text-sidebar-foreground/60">
                Special Education AI
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((section, i) => {
          const items = section.items.filter((it) => !it.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={i}>
              {section.label && !collapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-[10px]">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = !!item.to && currentPath === item.to;
                    const content = (
                      <>
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                        {!collapsed && item.soon && (
                          <span className="ml-auto text-[9px] uppercase tracking-wide text-sidebar-foreground/40 border border-sidebar-foreground/20 rounded px-1 py-0.5">
                            Soon
                          </span>
                        )}
                      </>
                    );
                    return (
                      <SidebarMenuItem key={item.title}>
                        {item.to && !item.soon ? (
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.title}
                          >
                            <Link to={item.to}>{content}</Link>
                          </SidebarMenuButton>
                        ) : (
                          <SidebarMenuButton
                            tooltip={item.title}
                            className="opacity-60 cursor-not-allowed hover:bg-transparent"
                            disabled
                          >
                            {content}
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/40 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-semibold text-sm shrink-0">
              {(profile?.full_name || profile?.email || "U")[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {profile?.full_name?.trim() || profile?.email || "User"}
              </p>
              <span className="inline-block mt-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary-foreground text-[9px] uppercase tracking-wide px-2 py-0.5">
                {roleLabel(profile?.role)}
              </span>
            </div>
            <button
              onClick={signOut}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={signOut}
            className="mx-auto text-sidebar-foreground/60 hover:text-sidebar-foreground p-2 rounded"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar({ title }: { title: string }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="h-15 min-h-[60px] border-b border-border bg-card flex items-center gap-3 px-3 sm:px-6 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <SidebarTrigger className="-ml-1" />
      <div className="hidden sm:block">
        <h1 className="font-heading font-semibold text-foreground text-base leading-none">
          {title}
        </h1>
      </div>
      <div className="flex-1 max-w-md mx-auto hidden md:flex items-center relative">
        <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
        <Input
          placeholder="Search students, records..."
          className="pl-9 bg-background border-border h-9 rounded-lg"
        />
      </div>
      <div className="flex-1 md:hidden" />
      <button
        className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
          3
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted transition-colors">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
            {(profile?.full_name || profile?.email || "U")[0]?.toUpperCase()}
          </div>
          <div className="hidden md:block text-left leading-tight">
            <p className="text-xs font-medium text-foreground truncate max-w-[120px]">
              {profile?.full_name?.trim() || profile?.email || "User"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {roleLabel(profile?.role)}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium truncate">{profile?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
            <UserIcon className="h-4 w-4 mr-2" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings className="h-4 w-4 mr-2" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function titleForPath(path: string): string {
  if (path.startsWith("/students/")) return "Student Profile";
  if (path === "/admin") return "Dashboard";
  return "CARE System";
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <CareSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar title={titleForPath(path)} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
