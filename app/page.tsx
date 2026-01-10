'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  MapPin, 
  CheckCircle, 
  Edit3, 
  MessageSquare,
  Clock,
  Navigation,
  Mail,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Navigation as Nav } from '@/components/Navigation';
import { StatCard } from '@/components/StatCard';

interface Stats {
  pendingModeration: number;
  totalUsers: number;
  totalCheckIns: number;
  pendingEdits: number;
  pendingReviews: number;
  totalReviews: number;
  totalKm: number;
  totalPOIs: number;
  contentStats?: {
    withPhoto: number;
    withDescription: number;
    toEnrich: number;
  };
  waitlistCount: number;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    }

    if (user) {
      fetchStats();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
          <div className="h-4 w-24 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  const pendingTotal = (stats?.pendingModeration || 0) + (stats?.pendingEdits || 0) + (stats?.pendingReviews || 0);

  return (
    <div className="min-h-screen bg-gray-900">
      <Nav />
      
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-100">Dashboard</h1>
            <p className="text-gray-400 mt-1">Vue d'ensemble de Guide du Détour</p>
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-5 animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-20 mb-3"></div>
                  <div className="h-8 bg-gray-700 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : stats ? (
            <>
              {/* Moderation Alert */}
              {pendingTotal > 0 && (
                <div 
                  className="mb-6 bg-amber-900/30 border border-amber-700 rounded-xl p-4 cursor-pointer hover:bg-amber-900/50 transition-all"
                  onClick={() => router.push('/moderation')}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-800 p-2 rounded-lg">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-200">
                        {pendingTotal} élément{pendingTotal > 1 ? 's' : ''} en attente de modération
                      </p>
                      <p className="text-sm text-amber-400">
                        {stats.pendingModeration || 0} POI • {stats.pendingEdits || 0} modifications • {stats.pendingReviews || 0} commentaires
                      </p>
                    </div>
                    <span className="text-amber-400">→</span>
                  </div>
                </div>
              )}

              {/* POI Hero Card */}
              <div 
                className="mb-6 bg-gradient-to-br from-forest-900/50 to-forest-800/30 border border-forest-700/50 rounded-xl p-6 cursor-pointer hover:border-forest-600 transition-all"
                onClick={() => router.push('/pois')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-forest-400 text-sm font-medium mb-1">Points d'Intérêt</p>
                    <p className="text-4xl font-bold text-gray-100">
                      {(stats.totalPOIs || 0).toLocaleString()}
                    </p>
                    {stats.contentStats && (
                      <p className="text-sm text-gray-400 mt-2">
                        {stats.contentStats.withPhoto.toLocaleString()} avec photo • {stats.contentStats.withDescription.toLocaleString()} avec description • {stats.contentStats.toEnrich.toLocaleString()} à enrichir
                      </p>
                    )}
                  </div>
                  <div className="bg-forest-800/50 p-4 rounded-xl">
                    <MapPin className="w-8 h-8 text-forest-400" />
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="En attente"
                  value={stats.pendingModeration || 0}
                  icon={Clock}
                  color="amber"
                  onClick={() => router.push('/moderation')}
                />
                <StatCard
                  title="Utilisateurs"
                  value={stats.totalUsers || 0}
                  icon={Users}
                  color="blue"
                  onClick={() => router.push('/users')}
                />
                <StatCard
                  title="Check-ins"
                  value={stats.totalCheckIns || 0}
                  icon={CheckCircle}
                  color="green"
                />
                <StatCard
                  title="Modifications"
                  value={stats.pendingEdits || 0}
                  icon={Edit3}
                  color="purple"
                  subtitle="en attente"
                />
                <StatCard
                  title="Commentaires"
                  value={stats.totalReviews || 0}
                  icon={MessageSquare}
                  color="blue"
                />
                <StatCard
                  title="Distance totale"
                  value={stats.totalKm ? `${Math.round(stats.totalKm / 1000)}k` : '0'}
                  icon={Navigation}
                  color="green"
                  subtitle={`${(stats.totalKm || 0).toLocaleString()} km`}
                />
                <StatCard
                  title="Avec photo"
                  value={stats.contentStats?.withPhoto || 0}
                  icon={ImageIcon}
                  color="purple"
                  onClick={() => router.push('/pois?content=with-photo')}
                />
                <StatCard
                  title="Waitlist"
                  value={stats.waitlistCount || 0}
                  icon={Mail}
                  color="pink"
                  onClick={() => router.push('/waitlist')}
                />
              </div>

              {/* Quick Actions */}
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-100 mb-4">Actions rapides</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => router.push('/moderation?tab=pois')}
                    className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-forest-500 hover:bg-gray-750 transition-all text-left"
                  >
                    <div className="bg-forest-900 p-2 rounded-lg">
                      <MapPin className="w-5 h-5 text-forest-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-100">Modérer POI</p>
                      <p className="text-sm text-gray-400">{stats.pendingModeration || 0} en attente</p>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/pois?content=empty')}
                    className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-orange-500 hover:bg-gray-750 transition-all text-left"
                  >
                    <div className="bg-orange-900 p-2 rounded-lg">
                      <FileText className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-100">Enrichir POI</p>
                      <p className="text-sm text-gray-400">{stats.contentStats?.toEnrich || 0} sans description</p>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/waitlist')}
                    className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-pink-500 hover:bg-gray-750 transition-all text-left"
                  >
                    <div className="bg-pink-900 p-2 rounded-lg">
                      <Mail className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-100">Waitlist</p>
                      <p className="text-sm text-gray-400">{stats.waitlistCount || 0} en attente</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              Erreur de chargement des statistiques
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
