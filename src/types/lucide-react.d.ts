declare module "lucide-react" {
  import type { ComponentType, SVGProps } from "react";

  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  };
  export type LucideIcon = ComponentType<LucideProps>;

  export const Activity: LucideIcon;
  export const ArrowDownRight: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const Bell: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const Check: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const CircleAlert: LucideIcon;
  export const ClipboardCheck: LucideIcon;
  export const CloudDownload: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const LockKeyhole: LucideIcon;
  export const LogIn: LucideIcon;
  export const Mail: LucideIcon;
  export const Package: LucideIcon;
  export const PanelLeftClose: LucideIcon;
  export const PanelLeftOpen: LucideIcon;
  export const Plus: LucideIcon;
  export const ShoppingBasket: LucideIcon;
  export const Store: LucideIcon;
  export const Tag: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Wallet: LucideIcon;
  export const X: LucideIcon;
}
