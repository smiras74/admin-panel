'use client';

import { useEffect, useState, Suspense } from 'react';
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
  collection?: string; // 'pois' or 'custom_pois'
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

function ModerationContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use URL as single source of truth for active tab
  const tabFromUrl = searchParams.get('tab') as Tab;
  const activeTab: Tab = (tabFromUrl && ['pois', 'edits', 'reviews'].includes(tabFromUrl)) 
    ? tabFromUrl 
    : 'pois';
  
  const [pois, setPois] = useState<PendingPOI[]>([]);
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null);
  
  // Editing state
  const [editingPoi, setEditingPoi] = useState<PendingPOI | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    subcategory: '',
  });
  const [saving, setSaving] = useState(false);

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
    extra?: { poiId?: string; poiCollection?: string; changes?: any; collection?: string }
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
        if (type === 'new_poi') {
          setPois(prev => prev.filter(p => p.id !== id));
        } else if (type === 'edit') {
          setEdits(prev => prev.filter(e => e.id !== id));
        } else {
          setReviews(prev => prev.filter(r => r.id !== id));
        }
        // Refresh notification counts
        window.dispatchEvent(new Event('refresh-pending-counts'));
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

  // Open edit modal
  const openEditModal = (poi: PendingPOI) => {
    setEditingPoi(poi);
    setEditForm({
      name: poi.name || '',
      description: poi.description || '',
      category: poi.category || '',
      subcategory: poi.subcategory || '',
    });
  };

  // Save edits and approve
  const handleSaveAndApprove = async () => {
    if (!editingPoi) return;
    
    setSaving(true);
    try {
      // First update the POI in pending collection
      const updateResponse = await fetch('/api/moderation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPoi.id,
          collection: editingPoi.collection || 'custom_pois',
          updates: editForm,
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        alert('Erreur: ' + error.error);
        return;
      }

      // Then approve
      const approveResponse = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPoi.id,
          type: 'new_poi',
          action: 'approve',
          collection: editingPoi.collection,
        }),
      });

      if (approveResponse.ok) {
        setPois(prev => prev.filter(p => p.id !== editingPoi.id));
        setEditingPoi(null);
        window.dispatchEvent(new Event('refresh-pending-counts'));
      }
    } catch (error) {
      console.error('Error saving and approving:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'pois' as Tab, label: 'Nouveaux POI', shortLabel: 'POI', count: pois.length, icon: MapPin },
    { id: 'edits' as Tab, label: 'Modifications', shortLabel: 'Modifs', count: edits.length, icon: Edit3 },
    { id: 'reviews' as Tab, label: 'Commentaires', shortLabel: 'Avis', count: reviews.length, icon: MessageSquare },
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

          {/* Tabs - Scrollable on mobile */}
          <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(`/moderation?tab=${tab.id}`)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-forest-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm sm:text-base">
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                  {tab.count > 0 && (
                    <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id
                        ? 'bg-forest-500 text-white'
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
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
            </div>
          ) : (
            <>
              {/* POIs Tab */}
              {activeTab === 'pois' && (
                <div className="space-y-4">
                  {pois.length === 0 ? (
                    <div className="text-center py-12">
                      <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Aucun nouveau POI en attente</p>
                    </div>
                  ) : (
                    pois.map(poi => (
                      <div 
                        key={poi.id} 
                        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                      >
                        {/* Main content */}
                        <div className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            {poi.photoUrls && poi.photoUrls.length > 0 ? (
                              <img 
                                src={poi.photoUrls[0]} 
                                alt={poi.name}
                                className="w-full sm:w-24 h-40 sm:h-24 object-cover rounded-lg shrink-0"
                              />
                            ) : (
                              <div className="w-full sm:w-24 h-40 sm:h-24 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                                <MapPin className="w-8 h-8 text-gray-500" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded-full">
                                  Nouveau POI
                                </span>
                                {poi.category && (
                                  <span className="text-gray-500 text-sm">{poi.category}</span>
                                )}
                                {poi.subcategory && (
                                  <span className="text-gray-600 text-sm">• {poi.subcategory}</span>
                                )}
                              </div>
                              <h3 className="font-medium text-gray-100 text-lg">{poi.name}</h3>
                              
                              {/* Description - expandable */}
                              {poi.description && (
                                <div className="mt-2">
                                  <p 
                                    className={`text-gray-400 text-sm ${
                                      expandedDescription === poi.id ? '' : 'line-clamp-2'
                                    }`}
                                  >
                                    {poi.description}
                                  </p>
                                  {poi.description.length > 100 && (
                                    <button
                                      onClick={() => setExpandedDescription(
                                        expandedDescription === poi.id ? null : poi.id
                                      )}
                                      className="text-forest-400 text-sm mt-1 hover:text-forest-300"
                                    >
                                      {expandedDescription === poi.id ? '▲ Réduire' : '▼ Lire tout'}
                                    </button>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {poi.userId || 'Anonyme'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(poi.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 p-4 pt-0 sm:pt-4 border-t border-gray-700 bg-gray-850">
                          <button
                            onClick={() => openEditModal(poi)}
                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Modifier</span>
                          </button>
                          <button
                            onClick={() => handleAction(poi.id, 'new_poi', 'approve', { collection: poi.collection })}
                            disabled={processing === poi.id}
                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {processing === poi.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            <span>Approuver</span>
                          </button>
                          <button
                            onClick={() => handleAction(poi.id, 'new_poi', 'reject', { collection: poi.collection })}
                            disabled={processing === poi.id}
                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            <span>Rejeter</span>
                          </button>
                        </div>
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
                        <button
                          onClick={() => setExpandedItem(expandedItem === edit.id ? null : edit.id)}
                          className="w-full p-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-750 transition-all"
                        >
                          <div className="w-10 h-10 rounded-lg bg-amber-900 flex items-center justify-center shrink-0">
                            <Edit3 className="w-5 h-5 text-amber-400" />
                          </div>

                          <div className="flex-1 text-left min-w-0">
                            <span className="px-2 py-0.5 bg-amber-900 text-amber-300 text-xs rounded-full">
                              Modification
                            </span>
                            <h3 className="font-medium text-gray-100 truncate mt-1">{edit.poiName}</h3>
                          </div>

                          <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform shrink-0 ${
                            expandedItem === edit.id ? 'rotate-90' : ''
                          }`} />
                        </button>

                        {expandedItem === edit.id && (
                          <div className="p-4 border-t border-gray-700 bg-gray-850">
                            {edit.changes.name && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm font-medium">Nom:</span>
                                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                            {edit.changes.description && (
                              <div className="mb-4">
                                <span className="text-gray-500 text-sm font-medium">Description:</span>
                                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                            {!edit.changes.name && !edit.changes.description && (
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
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
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
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                          </div>

                          <div className="flex gap-2 mt-3 sm:mt-0">
                            <button
                              onClick={() => handleAction(review.id, 'review', 'approve')}
                              disabled={processing === review.id}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {processing === review.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span className="sm:hidden">Approuver</span>
                            </button>
                            <button
                              onClick={() => handleAction(review.id, 'review', 'reject')}
                              disabled={processing === review.id}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              <span className="sm:hidden">Rejeter</span>
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

      {/* Edit Modal */}
      {editingPoi && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-medium text-gray-100">Modifier avant approbation</h2>
              <button 
                onClick={() => setEditingPoi(null)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Preview photo */}
              {editingPoi.photoUrls && editingPoi.photoUrls.length > 0 && (
                <img 
                  src={editingPoi.photoUrls[0]} 
                  alt={editingPoi.name}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-forest-500 focus:outline-none"
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Catégorie</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-forest-500 focus:outline-none"
                  >
                    <option value="">Sélectionner</option>
                    <option value="culture">Culture</option>
                    <option value="gastro">Gastronomie</option>
                    <option value="nature">Nature</option>
                    <option value="curiosites">Curiosités</option>
                    <option value="hedonisme">Hédonisme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Sous-catégorie</label>
                  <input
                    type="text"
                    value={editForm.subcategory}
                    onChange={(e) => setEditForm(prev => ({ ...prev, subcategory: e.target.value }))}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-forest-500 focus:outline-none"
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={5}
                  className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-forest-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t border-gray-700">
              <button
                onClick={() => setEditingPoi(null)}
                className="flex-1 p-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveAndApprove}
                disabled={saving || !editForm.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Enregistrer & Approuver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
      </div>
    }>
      <ModerationContent />
    </Suspense>
  );
}
