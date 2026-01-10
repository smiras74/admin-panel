'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Shield, 
  MapPin, 
  Users, 
  Menu,
  X,
  LogOut,
  Bell,
  AlertTriangle,
  MessageSquare,
  Edit3,
  PlusCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: 'moderation' | 'reports';
}

interface PendingCounts {
  pois: number;
  edits: number;
  reviews: number;
  reports: number;
  total: number;
}

export function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [counts, setCounts] = useState<PendingCounts>({ pois: 0, edits: 0, reviews: 0, reports: 0, total: 0 });
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch pending counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch('/api/pending-counts');
        if (response.ok) {
          const data = await response.json();
          setCounts(data);
        }
      } catch (error) {
        console.error('Error fetching pending counts:', error);
      }
    };

    if (user) {
      fetchCounts();
      // Refresh every 30 seconds
      const interval = setInterval(fetchCounts, 30000);
      
      // Listen for manual refresh event
      const handleRefresh = () => fetchCounts();
      window.addEventListener('refresh-pending-counts', handleRefresh);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('refresh-pending-counts', handleRefresh);
      };
    }
  }, [user]);

  const moderationCount = counts.pois + counts.edits + counts.reviews;

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/moderation', label: 'Modération', icon: Shield, badgeKey: 'moderation' },
    { href: '/reports', label: 'Signalements', icon: AlertTriangle, badgeKey: 'reports' },
    { href: '/pois', label: 'POIs', icon: MapPin },
    { href: '/users', label: 'Utilisateurs', icon: Users },
  ];

  const getBadgeCount = (badgeKey?: 'moderation' | 'reports'): number => {
    if (!badgeKey) return 0;
    if (badgeKey === 'moderation') return moderationCount;
    if (badgeKey === 'reports') return counts.reports;
    return 0;
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Notification items for dropdown
  const notificationItems = [
    { 
      href: '/moderation?tab=pois', 
      label: 'Nouveaux POI', 
      count: counts.pois, 
      icon: PlusCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-900/50'
    },
    { 
      href: '/moderation?tab=edits', 
      label: 'Modifications', 
      count: counts.edits, 
      icon: Edit3,
      color: 'text-amber-400',
      bgColor: 'bg-amber-900/50'
    },
    { 
      href: '/moderation?tab=reviews', 
      label: 'Commentaires', 
      count: counts.reviews, 
      icon: MessageSquare,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/50'
    },
    { 
      href: '/reports', 
      label: 'Signalements', 
      count: counts.reports, 
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-900/50'
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-gray-800 border-r border-gray-700">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-forest-500 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-100">Guide du Détour</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badgeCount = getBadgeCount(item.badgeKey);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-default
                  ${active 
                    ? 'bg-forest-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className={`text-white text-xs px-2 py-0.5 rounded-full ${
                    item.badgeKey === 'reports' ? 'bg-orange-500' : 'bg-red-500'
                  }`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-forest-800 rounded-full flex items-center justify-center">
              <span className="text-forest-300 font-medium text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500">Administrateur</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-gray-500 hover:text-gray-300 transition-default"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gray-800 border-b border-gray-700 z-40 px-4">
        <div className="flex items-center justify-between h-full">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 text-gray-300"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-forest-500 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-100">Admin</span>
          </div>

          {/* Notification Bell with Dropdown */}
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 -mr-2 text-gray-300 relative"
            >
              <Bell className="w-6 h-6" />
              {counts.total > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold">
                  {counts.total > 99 ? '99+' : counts.total}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {notificationsOpen && (
              <div className="absolute right-0 top-12 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="font-semibold text-gray-100">Notifications</h3>
                  <p className="text-xs text-gray-500">{counts.total} en attente</p>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {notificationItems.map((item) => {
                    const Icon = item.icon;
                    if (item.count === 0) return null;
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setNotificationsOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700/50 transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${item.color}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-200">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.count} en attente</p>
                        </div>
                        <span className={`text-white text-xs px-2 py-1 rounded-full ${
                          item.href.includes('reports') ? 'bg-orange-500' : 'bg-red-500'
                        }`}>
                          {item.count}
                        </span>
                      </Link>
                    );
                  })}
                  
                  {counts.total === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Aucune notification</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/70 z-50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`
        md:hidden fixed top-0 left-0 bottom-0 w-72 bg-gray-800 z-50
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-forest-500 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-100">Guide du Détour</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 -mr-2 text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badgeCount = getBadgeCount(item.badgeKey);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium
                  ${active 
                    ? 'bg-forest-600 text-white' 
                    : 'text-gray-300 active:bg-gray-700'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className={`text-white text-xs px-2 py-0.5 rounded-full ${
                    item.badgeKey === 'reports' ? 'bg-orange-500' : 'bg-red-500'
                  }`}>
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-400 rounded-lg hover:bg-red-900/30"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badgeCount = getBadgeCount(item.badgeKey);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center gap-1 px-3 py-2 relative
                  ${active ? 'text-forest-400' : 'text-gray-500'}
                `}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badgeCount > 0 && (
                    <span className={`absolute -top-1.5 -right-2.5 text-white text-[10px] min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center font-bold ${
                      item.badgeKey === 'reports' ? 'bg-orange-500' : 'bg-red-500'
                    }`}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
