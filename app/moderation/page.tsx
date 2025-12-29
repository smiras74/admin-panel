'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  MapPin,
  Edit3,
  MessageSquare,
  Loader2,
  Check,
  X,
  ChevronRight,
  ExternalLink,
  User,
  Clock,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/Navigation';

interface PendingPOI {
  id: string;
  type: 'new_poi';
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  latitude?: number;
  longitude?: number;
  photoUrls?: string[];
  userId?: string;
  status: string;
  createdAt?: string;
}

interface PendingEdit {
  id: string;
  type: 'edit';
  poiId: string;
  poiCollection: string;
  poiName: string;
  changes: {
    name?: string;
    description?: string;
    photoUrls?: string[];
  };
  original?: {
    name?: string;
    description?: string;
    photoUrls?: string[];
  };
  userId?: string;
  status: string;
  createdAt?: string;
}

interface PendingReview {
  id: string;
  type: 'review';
  poiId: string;
  poiName: string;
  rating?: number;
  comment?: string;
  photoUrls?: string[];
  userId?: string;
  status: string;
  createdAt?: string;
}

type Tab = 'pois' | 'edits' | 'reviews';

export default function ModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'pois');
  const [pois, setPois] = useState<PendingPOI[]>([]);
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchModeration();
  }, [user]);

  const fetchModeration = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/moderation?type=all');
      if (response.ok) {
        const data = await response.json();
        setPois(data.pois || []);
        setEdits(data.edits || []);
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching moderation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    id: string, 
    type: 'new_poi' | 'edit' | 'review', 
    action: 'approve' | 'reject',
    extra?: { poiId?: string; poiCollection?: string; changes?: any }
  ) => {
    setProcessing(id);
    try {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type,
          action,
          ...extra,
        }),
      });

      if (response.ok) {
        // Remove from list
        if (type === 'new_poi') {
          setPois(prev => prev.filter(p => p.id !== id));
        } else if (type === 'edit') {
          setEdits(prev => prev.filter(e => e.id !== id));
        } else {
          setReviews(prev => prev.filter(r => r.id !== id));
        }
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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'pois' as Tab, label: 'Nouveaux POI', count: pois.length, icon: MapPin },
    { id: 'edits' as Tab, label: 'Modifications', count: edits.length, icon: Edit3 },
    { id: 'reviews' as Tab, label: 'Commentaires', count: reviews.length, icon: MessageSquare },
  ];

  const totalPending = pois.length + edits.length + reviews.length;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-100">Modération</h1>
            <p className="text-gray-400 mt-1">
              {totalPending} élément{totalPending !== 1 ? 's' : ''} en attente
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-forest-900 text-forest-300 border border-forest-700'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id 
                        ? 'bg-forest-700 text-forest-200' 
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* New POIs Tab */}
              {activeTab === 'pois' && (
                <div className="space-y-4">
                  {pois.length === 0 ? (
                    <div className="text-center py-12">
                      <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Aucun POI en attente</p>
                    </div>
                  ) : (
                    pois.map(poi => (
                      <div 
                        key={poi.id} 
                        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                      >
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-750"
                          onClick={() => setExpandedItem(expandedItem === poi.id ? null : poi.id)}
                        >
                          <div className="flex items-start gap-4">
                            {/* Photo */}
                            <div className="w-16 h-16 rounded-lg bg-gray-700 overflow-hidden shrink-0">
                              {poi.photoUrls && poi.photoUrls[0] ? (
                                <img src={poi.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-gray-600" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded-full">
                                  Nouveau POI
                                </span>
                              </div>
                              <h3 className="font-medium text-gray-100 mt-1">{poi.name}</h3>
                              <p className="text-sm text-gray-400 line-clamp-1">{poi.description || 'Pas de description'}</p>
                              
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                {poi.category && (
                                  <span>{poi.category}</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(poi.createdAt)}
                                </span>
                              </div>
                            </div>

                            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedItem === poi.id ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedItem === poi.id && (
                          <div className="border-t border-gray-700 p-4 bg-gray-850">
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                              <div>
                                <span className="text-gray-500">Catégorie:</span>
                                <span className="ml-2 text-gray-300">{poi.category || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Sous-catégorie:</span>
                                <span className="ml-2 text-gray-300">{poi.subcategory || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Coordonnées:</span>
                                <a 
                                  href={`https://www.google.com/maps?q=${poi.latitude},${poi.longitude}`}
                                  target="_blank"
                                  className="ml-2 text-forest-400 hover:text-forest-300"
                                >
                                  {poi.latitude?.toFixed(5)}, {poi.longitude?.toFixed(5)}
                                  <ExternalLink className="w-3 h-3 inline ml-1" />
                                </a>
                              </div>
                              <div>
                                <span className="text-gray-500">Utilisateur:</span>
                                <span className="ml-2 text-gray-300">{poi.userId || '—'}</span>
                              </div>
                            </div>

                            {poi.description && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm">Description:</span>
                                <p className="mt-1 text-gray-300 text-sm">{poi.description}</p>
                              </div>
                            )}

                            {poi.photoUrls && poi.photoUrls.length > 0 && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm">Photos ({poi.photoUrls.length}):</span>
                                <div className="flex gap-2 mt-2">
                                  {poi.photoUrls.map((url, i) => (
                                    <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-4 border-t border-gray-700">
                              <button
                                onClick={() => handleAction(poi.id, 'new_poi', 'approve')}
                                disabled={processing === poi.id}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                {processing === poi.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                                Approuver
                              </button>
                              <button
                                onClick={() => handleAction(poi.id, 'new_poi', 'reject')}
                                disabled={processing === poi.id}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                                Rejeter
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Edits Tab */}
              {activeTab === 'edits' && (
                <div className="space-y-4">
                  {edits.length === 0 ? (
                    <div className="text-center py-12">
                      <Edit3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Aucune modification en attente</p>
                    </div>
                  ) : (
                    edits.map(edit => (
                      <div 
                        key={edit.id} 
                        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                      >
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-750"
                          onClick={() => setExpandedItem(expandedItem === edit.id ? null : edit.id)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-900 flex items-center justify-center shrink-0">
                              <Edit3 className="w-5 h-5 text-purple-400" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-purple-900 text-purple-300 text-xs rounded-full">
                                  Modification
                                </span>
                              </div>
                              <h3 className="font-medium text-gray-100 mt-1">{edit.poiName}</h3>
                              
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {edit.userId || 'Anonyme'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(edit.createdAt)}
                                </span>
                              </div>
                            </div>

                            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedItem === edit.id ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded Diff View */}
                        {expandedItem === edit.id && (
                          <div className="border-t border-gray-700 p-4 bg-gray-850">
                            {/* Name Diff */}
                            {edit.changes.name !== undefined && edit.changes.name !== edit.original?.name && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm font-medium">Nom:</span>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-red-900/30 border border-red-800 rounded-lg">
                                    <span className="text-xs text-red-400 block mb-1">Avant</span>
                                    <span className="text-gray-300">{edit.original?.name || '—'}</span>
                                  </div>
                                  <div className="p-2 bg-green-900/30 border border-green-800 rounded-lg">
                                    <span className="text-xs text-green-400 block mb-1">Après</span>
                                    <span className="text-gray-300">{edit.changes.name}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Description Diff */}
                            {edit.changes.description !== undefined && edit.changes.description !== edit.original?.description && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm font-medium">Description:</span>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-red-900/30 border border-red-800 rounded-lg">
                                    <span className="text-xs text-red-400 block mb-1">Avant</span>
                                    <span className="text-gray-300 text-sm">{edit.original?.description || '—'}</span>
                                  </div>
                                  <div className="p-2 bg-green-900/30 border border-green-800 rounded-lg">
                                    <span className="text-xs text-green-400 block mb-1">Après</span>
                                    <span className="text-gray-300 text-sm">{edit.changes.description}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Photos Diff */}
                            {edit.changes.photoUrls !== undefined && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm font-medium">Photos:</span>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-red-900/30 border border-red-800 rounded-lg">
                                    <span className="text-xs text-red-400 block mb-1">Avant ({edit.original?.photoUrls?.length || 0})</span>
                                    <div className="flex gap-1 flex-wrap">
                                      {edit.original?.photoUrls?.map((url, i) => (
                                        <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded" />
                                      )) || <span className="text-gray-500 text-sm">Aucune photo</span>}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-green-900/30 border border-green-800 rounded-lg">
                                    <span className="text-xs text-green-400 block mb-1">Après ({edit.changes.photoUrls?.length || 0})</span>
                                    <div className="flex gap-1 flex-wrap">
                                      {edit.changes.photoUrls?.map((url, i) => (
                                        <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded" />
                                      )) || <span className="text-gray-500 text-sm">Aucune photo</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* No Changes */}
                            {!edit.changes.name && !edit.changes.description && !edit.changes.photoUrls && (
                              <div className="flex items-center gap-2 text-gray-500 mb-4">
                                <AlertCircle className="w-4 h-4" />
                                <span>Aucun changement détecté</span>
                              </div>
                            )}

                            <div className="flex gap-2 pt-4 border-t border-gray-700">
                              <button
                                onClick={() => handleAction(edit.id, 'edit', 'approve', {
                                  poiId: edit.poiId,
                                  poiCollection: edit.poiCollection,
                                  changes: edit.changes,
                                })}
                                disabled={processing === edit.id}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                {processing === edit.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                                Approuver
                              </button>
                              <button
                                onClick={() => handleAction(edit.id, 'edit', 'reject')}
                                disabled={processing === edit.id}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                                Rejeter
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Reviews Tab */}
              {activeTab === 'reviews' && (
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Aucun commentaire en attente</p>
                    </div>
                  ) : (
                    reviews.map(review => (
                      <div 
                        key={review.id} 
                        className="bg-gray-800 rounded-xl border border-gray-700 p-4"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-blue-900 text-blue-300 text-xs rounded-full">
                                Commentaire
                              </span>
                              <span className="text-gray-400 text-sm">sur {review.poiName}</span>
                            </div>
                            
                            {review.rating && (
                              <div className="flex items-center gap-1 mb-2">
                                {[...Array(5)].map((_, i) => (
                                  <span 
                                    key={i} 
                                    className={i < review.rating! ? 'text-amber-400' : 'text-gray-600'}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            <p className="text-gray-300">{review.comment || 'Pas de commentaire'}</p>
                            
                            {/* Photos */}
                            {review.photoUrls && review.photoUrls.length > 0 && (
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {review.photoUrls.map((url, i) => (
                                  <a 
                                    key={i} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img 
                                      src={url} 
                                      alt={`Photo ${i + 1}`} 
                                      className="w-20 h-20 object-cover rounded-lg border border-gray-700 hover:border-gray-500 transition-all" 
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {review.userId || 'Anonyme'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(review.createdAt)}
                              </span>
                              {review.photoUrls && review.photoUrls.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {review.photoUrls.length} photo{review.photoUrls.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(review.id, 'review', 'approve')}
                              disabled={processing === review.id}
                              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {processing === review.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleAction(review.id, 'review', 'reject')}
                              disabled={processing === review.id}
                              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
