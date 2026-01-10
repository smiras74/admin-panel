'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle,
  Loader2,
  Check,
  X,
  Trash2,
  MapPin,
  User,
  Clock,
  MessageSquare,
  ExternalLink,
  XCircle,
  AlertCircle,
  Lock
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/Navigation';

interface Report {
  id: string;
  poiId: string;
  poiName: string;
  type: 'closed' | 'incorrect' | 'inaccessible';
  comment?: string;
  photoUrl?: string;
  userId: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt?: string;
  poiLocation?: {
    latitude: number;
    longitude: number;
  };
}

const reportTypeConfig = {
  closed: {
    label: "N'existe plus",
    description: 'Fermé, démoli, déplacé ou faux',
    icon: XCircle,
    bgColor: 'bg-red-900',
    textColor: 'text-red-300',
  },
  incorrect: {
    label: 'Infos incorrectes',
    description: 'Description, photo, catégorie ou horaires erronés',
    icon: AlertCircle,
    bgColor: 'bg-orange-900',
    textColor: 'text-orange-300',
  },
  inaccessible: {
    label: 'Accès impossible',
    description: 'Propriété privée, route barrée, dangereux',
    icon: Lock,
    bgColor: 'bg-yellow-900',
    textColor: 'text-yellow-300',
  },
};

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved'>('pending');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user, filter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    reportId: string, 
    action: 'resolve' | 'reject' | 'delete_poi',
    poiId?: string
  ) => {
    setProcessing(reportId);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          action,
          poiId,
        }),
      });

      if (response.ok) {
        setReports(prev => prev.filter(r => r.id !== reportId));
      }
    } catch (error) {
      console.error('Error processing action:', error);
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openInMaps = (lat?: number, lng?: number) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-100">Signalements</h1>
                <p className="text-gray-400">
                  {reports.length} signalement{reports.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'pending', label: 'En attente' },
              { id: 'reviewed', label: 'Traités' },
              { id: 'resolved', label: 'Résolus' },
              { id: 'all', label: 'Tous' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filter === tab.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucun signalement</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map(report => {
                const config = reportTypeConfig[report.type] || reportTypeConfig.incorrect;
                const Icon = config.icon;
                
                return (
                  <div 
                    key={report.id} 
                    className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        {/* Type Icon */}
                        <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-6 h-6 ${config.textColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Type Badge */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 ${config.bgColor} ${config.textColor} text-xs rounded-full`}>
                              {config.label}
                            </span>
                            <span className="text-gray-500 text-sm">{config.description}</span>
                          </div>
                          
                          {/* POI Name */}
                          <h3 className="font-medium text-gray-100 mb-2 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            {report.poiName}
                            {report.poiLocation && (
                              <button
                                onClick={() => openInMaps(report.poiLocation?.latitude, report.poiLocation?.longitude)}
                                className="text-forest-400 hover:text-forest-300"
                                title="Voir sur Google Maps"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </h3>

                          {/* Comment */}
                          {report.comment && (
                            <div className="flex items-start gap-2 mb-3 p-3 bg-gray-900 rounded-lg">
                              <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                              <p className="text-gray-300 text-sm">{report.comment}</p>
                            </div>
                          )}

                          {/* Photo */}
                          {report.photoUrl && (
                            <div className="mb-3">
                              <a href={report.photoUrl} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={report.photoUrl} 
                                  alt="Photo du signalement"
                                  className="w-full sm:w-48 h-32 object-cover rounded-lg border border-gray-700 hover:border-gray-500 transition-all"
                                />
                              </a>
                            </div>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {report.userId?.slice(0, 8) || 'Anonyme'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(report.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {report.status === 'pending' && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            <button
                              onClick={() => handleAction(report.id, 'resolve')}
                              disabled={processing === report.id}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                              title="Marquer comme traité"
                            >
                              {processing === report.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span className="sm:hidden">Traité</span>
                            </button>

                            <button
                              onClick={() => handleAction(report.id, 'reject')}
                              disabled={processing === report.id}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 text-sm"
                              title="Ignorer"
                            >
                              <X className="w-4 h-4" />
                              <span className="sm:hidden">Ignorer</span>
                            </button>

                            {report.type === 'closed' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Supprimer le POI "${report.poiName}" ?`)) {
                                    handleAction(report.id, 'delete_poi', report.poiId);
                                  }
                                }}
                                disabled={processing === report.id}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                                title="Supprimer le POI"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="sm:hidden">Supprimer</span>
                              </button>
                            )}
                          </div>
                        )}

                        {report.status !== 'pending' && (
                          <span className={`px-3 py-1 rounded-full text-xs ${
                            report.status === 'resolved' 
                              ? 'bg-green-900 text-green-300'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {report.status === 'resolved' ? 'Résolu' : 'Traité'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
