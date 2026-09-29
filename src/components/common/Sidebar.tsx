import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  FolderOpen,
  CheckSquare,
  MapPin,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Waves,
} from 'lucide-react';
import { useSonarContext } from '../../context/SonarContext';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onMobileClose,
}) => {
  const { pendingReviewCount } = useSonarContext();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'New Analysis', path: '/new-analysis', icon: PlusCircle },
    { name: 'Analyses', path: '/analyses', icon: FolderOpen },
    {
      name: 'Review Queue',
      path: '/review-queue',
      icon: CheckSquare,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    { name: 'Map View', path: '/map', icon: MapPin },
    { name: 'Reports', path: '/reports', icon: FileBarChart },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`h-full bg-surface border-r border-border flex flex-col justify-between transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-[72px]' : 'w-[240px]'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-[64px] px-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-subtle">
              <Waves className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <span className="font-bold text-base text-text tracking-tight block leading-none">
                  AquaTrace!
                </span>
                <span className="text-[11px] font-medium text-muted tracking-wider uppercase block mt-1">
                  Sonar GIS Platform
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onMobileClose && onMobileClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-button text-xs font-medium transition-colors group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'bg-primary-tint text-primary font-semibold'
                      : 'text-text hover:bg-background hover:text-primary'
                  }`
                }
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="truncate flex-1">{item.name}</span>}

                {/* Pending Review Badge */}
                {item.badge !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full text-[11px] font-bold tabular-nums shrink-0 ${
                      isCollapsed
                        ? 'absolute top-2 right-2 w-4 h-4 bg-warning text-white text-[10px]'
                        : 'px-2 py-0.5 bg-warning-tint text-warning border border-warning/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t border-border hidden md:block">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-button text-xs font-medium text-muted hover:text-text hover:bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
