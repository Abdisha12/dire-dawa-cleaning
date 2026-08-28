// components/ui/icon.tsx — Lucide icon system (Phase 2 §7 + §8)
// Single source, no emoji as UI icons, no mixed styles.
// Decorative icons are aria-hidden; meaningful icons have aria-label via parent.

import {
  LayoutDashboard,
  Bell,
  Store,
  Search,
  HardHat,
  Wrench,
  CreditCard,
  ClipboardList,
  FolderOpen,
  FileText,
  BarChart3,
  Users,
  Settings,
  MapPinned,
  Building2,
  ScrollText,
  LogOut,
  Menu,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  TriangleAlert,
  ChevronRight,
  ChevronDown,
  SearchX,
  Inbox,
  CalendarCheck,
  Map,
  MessageSquare,
  TrendingUp,
  UserCircle,
  Cog,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

export const Icons = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  businesses: Store,
  inspections: Search,
  workers: HardHat,
  tools: Wrench,
  payments: CreditCard,
  zonereports: ClipboardList,
  documents: FolderOpen,
  reports: FileText,
  analytics: BarChart3,
  users: Users,
  settings: Settings,
  kebeles: Building2,
  zones: MapPinned,
  auditlog: ScrollText,
  logout: LogOut,
  menu: Menu,
  close: X,
  spinner: Loader2,
  alert: AlertCircle,
  success: CheckCircle,
  info: Info,
  warning: TriangleAlert,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  empty: SearchX,
  inbox: Inbox,
  attendance: CalendarCheck,
  gis: Map,
  complaints: MessageSquare,
  performance: TrendingUp,
  myaccount: UserCircle,
  system: Cog,
};

export type IconName = keyof typeof Icons;

export function AppIcon({
  name,
  decorative = true,
  className,
  size = 18,
  ...props
}: {
  name: IconName;
  decorative?: boolean;
  className?: string;
  size?: number;
} & LucideProps) {
  const Cmp = Icons[name];
  return <Cmp aria-hidden={decorative} className={className} size={size} {...props} />;
}
