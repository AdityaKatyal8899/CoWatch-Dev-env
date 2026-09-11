import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  Video,
  User,
  Settings,
  LogOut,
  Play,
  Gem
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { MobileBottomDock } from './MobileBottomDock';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Upload, label: 'Upload', path: '/upload' },
    { icon: FolderOpen, label: 'Collections', path: '/collections' },
    { icon: Video, label: 'Create Stream', path: '/create-stream' },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: Gem, label: 'Plans', path: '/plans' },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[var(--bg,#0B0B0F)] text-white overflow-hidden transition-colors duration-300">
      {/* Mobile Top Header */}
      <header className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[var(--bg,#0B0B0F)]/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-lg"
            style={{ background: 'var(--primary-gradient, var(--primary))' }}
          >
            <Play className="w-3.5 h-3.5 text-[var(--primary-foreground,#ffffff)]" fill="currentColor" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">CoWatch</span>
        </Link>
        <Link href="/profile" className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
            {user?.profile_picture ? (
              <img 
                src={user.profile_picture} 
                alt={user.name || 'Profile'} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <User className="w-3.5 h-3.5 text-white/50" />
            )}
          </div>
        </Link>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 border-r border-white/5 flex-col bg-[var(--bg,#0B0B0F)] shrink-0 z-20">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              style={{ background: 'var(--primary-gradient, var(--primary))' }}
            >
              <Play className="w-4 h-4 text-[var(--primary-foreground,#ffffff)]" fill="currentColor" />
            </div>
            <h1 className="text-sm font-bold text-white tracking-tight">CoWatch</h1>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const isLocked = item.path === '/collections' && (!user?.plan || user.plan === 'free');
            
            return (
              <Link
                key={item.path}
                href={isLocked ? '/plans' : item.path}
                onClick={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    toast.error('Collections is only available on paid plans. Redirecting to plans...');
                    router.push('/plans');
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-white/10 text-white font-semibold shadow-sm'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[var(--primary)]' : 'group-hover:text-white/80'}`} />
                <span className="font-medium text-[13px] flex items-center justify-between w-full">
                  <span>{item.label}</span>
                  {isLocked && <span className="text-[10px]">🔒</span>}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] mb-3 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 shrink-0 overflow-hidden">
              {user?.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-white/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[12px] font-semibold truncate leading-none mb-1">
                {user?.display_name || user?.name || 'User'}
              </p>
              <p className="text-white/30 text-[10px] font-medium truncate tracking-wide">
                Account
              </p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 transition-all font-semibold text-[11px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg,#0B0B0F)] transition-colors duration-300">
        <div className="min-h-full flex flex-col justify-between">
          <div className="flex-1">{children}</div>
          {/* Dedicated bottom clearance spacer so mobile dock never blocks content or actions */}
          <div className="h-32 lg:hidden shrink-0 pointer-events-none" />
        </div>
      </main>

      {/* Mobile Animated Bottom Dock */}
      <MobileBottomDock />
    </div>
  );
}
