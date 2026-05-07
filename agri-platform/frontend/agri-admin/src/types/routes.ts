export interface RouteMeta {
  title: string;
  permission?: string;
  icon?: string;
  hidden?: boolean;
}

export interface RouteConfig {
  path: string;
  name: string;
  icon?: string;
  component?: React.ComponentType | (() => Promise<{ default: React.ComponentType }>);
  redirect?: string;
  children?: RouteConfig[];
  meta?: RouteMeta;
}

export type Routes = RouteConfig[];
