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
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

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
  ];

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#0B0B0F] overflow-hidden">
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 right-4 z-[100] p-2 bg-white/10 text-white rounded-lg lg:hidden backdrop-blur-md border border-white/5"
      >
        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm lg:hidden z-[80] transition-opacity duration-300" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[90] w-60 border-r border-white/5 flex flex-col bg-[#0B0B0F] transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <Play className="w-4 h-4 text-[var(--bg)]" fill="currentColor" />
            </div>
            <h1 className="text-sm font-bold text-white tracking-tight">CoWatch</h1>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-white/5 text-white'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'group-hover:text-white/60'}`} />
                <span className="font-medium text-[13px]">{item.label}</span>
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
      <main className="flex-1 overflow-auto bg-[#0B0B0F]">
        {children}
      </main>
    </div>
  );
}
