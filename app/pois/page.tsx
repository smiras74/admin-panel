'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  MapPin,
  Loader2,
  ExternalLink,
  Star,
  CheckCircle,
  Image as ImageIcon,
  Database,
  Users,
  Verified,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileText,
  ImagePlus,
  CheckSquare,
  XSquare,
  Edit,
  Save,
  X,
  Trash2,
  Plus,
  Sparkles,
  Copy,
  Upload
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/Navigation';

interface POI {
  id: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  latitude?: number;
  longitude?: number;
  photoUrls?: string[];
  hasPhoto?: boolean;
  hasDescription?: boolean;
  averageRating?: number;
  ratingCount?: number;
  checkInCount?: number;
  source: 'verified' | 'osm' | 'user';
  status?: string;
  createdAt?: string;
  cachedAt?: string;
}

interface Counts {
  total: number;
}

interface ContentStats {
  withPhoto: number;
  withDescription: number;
  complete: number;
  empty: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  verified: { label: 'Vérifié', color: 'bg-green-900 text-green-300', icon: Verified },
  osm: { label: 'OSM', color: 'bg-blue-900 text-blue-300', icon: Database },
  user: { label: 'Utilisateur', color: 'bg-purple-900 text-purple-300', icon: Users },
};

const CATEGORIES = [
  { value: 'all', label: 'Toutes catégories' },
  { value: 'histoire', label: 'Histoire' },
  { value: 'nature', label: 'Nature' },
  { value: 'gastronomie', label: 'Gastronomie' },
  { value: 'panorama', label: 'Panorama' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'art', label: 'Art' },
  { value: 'hedonisme', label: 'Hédonisme' },
  { value: 'insolite', label: 'Insolite' },
  { value: 'curiosites', label: 'Curiosités' },
];

const ALL_CATEGORIES = [
  'histoire', 'nature', 'gastronomie', 'panorama', 
  'architecture', 'art', 'hedonisme', 'insolite', 'curiosites'
];

const SUBCATEGORIES: Record<string, string[]> = {
  histoire: ['monuments', 'chateaux', 'eglises', 'musees', 'sites-historiques', 'ruines', 'memorial', 'archeologie'],
  nature: ['parcs', 'jardins', 'forets', 'lacs', 'cascades', 'grottes', 'reserves', 'points-de-vue', 'fermes'],
  hedonisme: ['gastronomie', 'restaurants', 'cafes', 'bars', 'vins', 'vignobles', 'marches', 'spas', 'plages', 'brasseries', 'fromageries', 'brocantes', 'aires-de-repos', 'chambres-dhotes'],
  insolite: ['street-art', 'lieux-abandonnes', 'curiosites', 'ovni', 'mystere'],
  panorama: ['points-de-vue', 'belvederes', 'tours', 'collines'],
  architecture: ['moderne', 'classique', 'art-deco', 'contemporain', 'religieux', 'industriel'],
  art: ['galeries', 'sculptures', 'fresques', 'land-art', 'musees'],
  curiosites: ['insolite', 'mystere', 'legende', 'paranormal'],
};

const SORT_OPTIONS = [
  { value: 'name', label: 'Nom A-Z' },
  { value: 'name-desc', label: 'Nom Z-A' },
  { value: 'rating-desc', label: 'Mieux notés' },
  { value: 'checkIns-desc', label: 'Plus visités' },
  { value: 'createdAt-desc', label: 'Plus récents' },
  { value: 'createdAt', label: 'Plus anciens' },
];

export default function POIsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pois, setPois] = useState<POI[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0 });
  const [contentStats, setContentStats] = useState<ContentStats>({ withPhoto: 0, withDescription: 0, complete: 0, empty: 0 });
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [contentFilter, setContentFilter] = useState('all');
  const [sortOption, setSortOption] = useState('name');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Edit modal
  const [editingPoi, setEditingPoi] = useState<POI | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    subcategory: '',
    openingHours: '',
    photoUrls: [] as string[],
    newPhotoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichingAI, setEnrichingAI] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Photo viewer
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, sourceFilter, categoryFilter, subcategoryFilter, contentFilter, sortOption]);

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoryFilter('all');
  }, [categoryFilter]);

  // Initialize edit form when editing POI changes
  useEffect(() => {
    if (editingPoi) {
      setEditForm({
        name: editingPoi.name || '',
        description: editingPoi.description || '',
        category: editingPoi.category || '',
        subcategory: editingPoi.subcategory || '',
        openingHours: (editingPoi as any).openingHours || '',
        photoUrls: editingPoi.photoUrls || [],
        newPhotoUrl: '',
      });
    }
  }, [editingPoi]);

  const fetchPOIs = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (subcategoryFilter !== 'all') params.set('subcategory', subcategoryFilter);
      if (contentFilter !== 'all') params.set('content', contentFilter);
      
      const [sortBy, sortOrder] = sortOption.includes('-') 
        ? sortOption.split('-') 
        : [sortOption, 'asc'];
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      
      params.set('page', page.toString());
      params.set('limit', '50');

      const response = await fetch(`/api/pois?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPois(data.pois || []);
        setCounts({ total: data.totalInDatabase || data.pagination?.totalCount || 0 });
        setContentStats(data.contentStats || { withPhoto: 0, withDescription: 0, complete: 0, empty: 0 });
        setSubcategories(data.subcategories || []);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error('Error fetching POIs:', error);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, categoryFilter, subcategoryFilter, contentFilter, sortOption, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPOIs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchPOIs]);

  // Save POI changes
  const handleSave = async () => {
    if (!editingPoi) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/pois/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPoi.id,
          source: editingPoi.source,
          updates: {
            name: editForm.name,
            description: editForm.description,
            category: editForm.category,
            subcategory: editForm.subcategory,
            openingHours: editForm.openingHours,
            photoUrls: editForm.photoUrls,
          }
        })
      });

      if (response.ok) {
        setEditingPoi(null);
        fetchPOIs();
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.error || 'Échec de la sauvegarde'}`);
      }
    } catch (error) {
      console.error('Error saving POI:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Enrich from Wikipedia
  const handleEnrich = async () => {
    if (!editingPoi) return;
    
    setEnriching(true);
    try {
      const response = await fetch('/api/pois/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPoi.id,
          name: editForm.name,
          latitude: editingPoi.latitude,
          longitude: editingPoi.longitude,
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.description || data.photoUrl) {
          setEditForm(prev => ({
            ...prev,
            description: data.description || prev.description,
            photoUrls: data.photoUrl 
              ? [...new Set([data.photoUrl, ...prev.photoUrls])]
              : prev.photoUrls,
          }));
        } else {
          alert('Aucune donnée Wikipedia trouvée pour ce lieu');
        }
      } else {
        alert('Erreur lors de l\'enrichissement');
      }
    } catch (error) {
      console.error('Error enriching POI:', error);
      alert('Erreur lors de l\'enrichissement');
    } finally {
      setEnriching(false);
    }
  };

  // Enrich from AI (Claude)
  const handleEnrichAI = async () => {
    if (!editingPoi) return;
    
    setEnrichingAI(true);
    try {
      const response = await fetch('/api/pois/enrich-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name || editingPoi.name,
          category: editForm.category || editingPoi.category,
          subcategory: editForm.subcategory || editingPoi.subcategory,
          latitude: editingPoi.latitude,
          longitude: editingPoi.longitude,
          existingDescription: editForm.description,
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.description) {
          setEditForm(prev => ({
            ...prev,
            description: data.description,
            openingHours: data.openingHours || prev.openingHours,
          }));
        } else {
          alert('Impossible de générer une description');
        }
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.error || 'Échec de la génération'}`);
      }
    } catch (error) {
      console.error('Error enriching POI with AI:', error);
      alert('Erreur lors de la génération AI');
    } finally {
      setEnrichingAI(false);
    }
  };

  // Copy AI prompt to clipboard for manual use
  const handleCopyPrompt = () => {
    if (!editingPoi) return;
    
    const prompt = `Quel est cet établissement situé aux coordonnées ${editingPoi.latitude?.toFixed(6)}, ${editingPoi.longitude?.toFixed(6)} en France ?

Nom apparent: "${editForm.name || editingPoi.name}"
Catégorie: ${editForm.category || editingPoi.category || 'non spécifiée'}
Sous-catégorie: ${editForm.subcategory || editingPoi.subcategory || 'non spécifiée'}

Recherche des informations sur ce lieu et donne-moi une réponse dans ce format exact:

Nom: [nom exact de l'établissement]
Description: [2-4 phrases décrivant le lieu, son ambiance et ses spécialités]
Horaires: [heures d'ouverture si connues, sinon "Non disponibles"]
Source: [lien vers le site officiel, Google Maps, ou TripAdvisor]`;

    navigator.clipboard.writeText(prompt).then(() => {
      alert('✅ Prompt copié ! Collez-le dans ChatGPT, Claude ou Perplexity.');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = prompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('✅ Prompt copié !');
    });
  };

  // Add photo URL
  const handleAddPhoto = () => {
    if (editForm.newPhotoUrl.trim()) {
      setEditForm(prev => ({
        ...prev,
        photoUrls: [...prev.photoUrls, prev.newPhotoUrl.trim()],
        newPhotoUrl: '',
      }));
    }
  };

  // Upload photo file
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingPoi) return;

    setUploading(true);
    
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        // Validate file
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} n'est pas une image`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} est trop volumineux (max 5MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('poiId', editingPoi.id);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.url);
        } else {
          const error = await response.json();
          alert(`Erreur upload ${file.name}: ${error.error}`);
        }
      }

      if (uploadedUrls.length > 0) {
        setEditForm(prev => ({
          ...prev,
          photoUrls: [...prev.photoUrls, ...uploadedUrls],
        }));
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  // Remove photo
  const handleRemovePhoto = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      photoUrls: prev.photoUrls.filter((_, i) => i !== index),
    }));
  };

  // Delete POI
  const handleDelete = async () => {
    if (!editingPoi) return;
    
    setDeleting(true);
    try {
      const response = await fetch('/api/pois/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPoi.id,
          source: editingPoi.source,
        })
      });

      if (response.ok) {
        setEditingPoi(null);
        setShowDeleteConfirm(false);
        fetchPOIs();
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.error || 'Échec de la suppression'}`);
      }
    } catch (error) {
      console.error('Error deleting POI:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  // Photo navigation
  const openPhotoViewer = (url: string, index: number) => {
    setViewingPhoto(url);
    setViewingPhotoIndex(index);
  };

  const nextPhoto = () => {
    if (editForm.photoUrls.length > 1) {
      const nextIndex = (viewingPhotoIndex + 1) % editForm.photoUrls.length;
      setViewingPhotoIndex(nextIndex);
      setViewingPhoto(editForm.photoUrls[nextIndex]);
    }
  };

  const prevPhoto = () => {
    if (editForm.photoUrls.length > 1) {
      const prevIndex = (viewingPhotoIndex - 1 + editForm.photoUrls.length) % editForm.photoUrls.length;
      setViewingPhotoIndex(prevIndex);
      setViewingPhoto(editForm.photoUrls[prevIndex]);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
      </div>
    );
  }

  const totalPOIs = counts.total;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-100">Points d'Intérêt</h1>
            <p className="text-gray-400 mt-1">
              {totalPOIs.toLocaleString()} POI au total
            </p>
          </div>

          {/* Content Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <button
              onClick={() => setContentFilter(contentFilter === 'complete' ? 'all' : 'complete')}
              className={`p-3 rounded-xl border transition-all ${
                contentFilter === 'complete'
                  ? 'bg-green-900/50 border-green-500 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Complets</span>
              </div>
              <p className="text-xl font-bold mt-1">{contentStats.complete}</p>
            </button>
            
            <button
              onClick={() => setContentFilter(contentFilter === 'with-photo' ? 'all' : 'with-photo')}
              className={`p-3 rounded-xl border transition-all ${
                contentFilter === 'with-photo'
                  ? 'bg-blue-900/50 border-blue-500 text-blue-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <ImagePlus className="w-4 h-4" />
                <span className="text-sm font-medium">Avec photo</span>
              </div>
              <p className="text-xl font-bold mt-1">{contentStats.withPhoto}</p>
            </button>
            
            <button
              onClick={() => setContentFilter(contentFilter === 'with-description' ? 'all' : 'with-description')}
              className={`p-3 rounded-xl border transition-all ${
                contentFilter === 'with-description'
                  ? 'bg-purple-900/50 border-purple-500 text-purple-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Avec description</span>
              </div>
              <p className="text-xl font-bold mt-1">{contentStats.withDescription}</p>
            </button>
            
            <button
              onClick={() => setContentFilter(contentFilter === 'empty' ? 'all' : 'empty')}
              className={`p-3 rounded-xl border transition-all ${
                contentFilter === 'empty'
                  ? 'bg-orange-900/50 border-orange-500 text-orange-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <XSquare className="w-4 h-4" />
                <span className="text-sm font-medium">À enrichir</span>
              </div>
              <p className="text-xl font-bold mt-1">{contentStats.empty}</p>
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                showFilters 
                  ? 'bg-forest-900 border-forest-500 text-forest-300' 
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filtres</span>
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Catégorie</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Sous-catégorie</label>
                  <select
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    <option value="all">Toutes sous-catégories</option>
                    {subcategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Tri</label>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {(categoryFilter !== 'all' || subcategoryFilter !== 'all' || contentFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Filtres actifs:</span>
              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300">
                  Catégorie: {categoryFilter}
                  <button onClick={() => setCategoryFilter('all')} className="text-gray-500 hover:text-gray-300">×</button>
                </span>
              )}
              {subcategoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300">
                  Sous-cat: {subcategoryFilter}
                  <button onClick={() => setSubcategoryFilter('all')} className="text-gray-500 hover:text-gray-300">×</button>
                </span>
              )}
              {contentFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300">
                  Contenu: {contentFilter}
                  <button onClick={() => setContentFilter('all')} className="text-gray-500 hover:text-gray-300">×</button>
                </span>
              )}
              <button 
                onClick={() => {
                  setCategoryFilter('all');
                  setSubcategoryFilter('all');
                  setContentFilter('all');
                }}
                className="text-xs text-forest-400 hover:text-forest-300"
              >
                Réinitialiser
              </button>
            </div>
          )}

          {/* POIs List */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gray-700 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : pois.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucun POI trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pois.map((poi) => {
                const sourceInfo = SOURCE_LABELS[poi.source] || SOURCE_LABELS.osm;
                const SourceIcon = sourceInfo.icon;
                
                return (
                  <div
                    key={poi.id}
                    className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-all cursor-pointer"
                    onClick={() => setEditingPoi(poi)}
                  >
                    <div className="flex gap-4">
                      {/* Photo */}
                      <div className="w-16 h-16 rounded-lg bg-gray-700 overflow-hidden shrink-0 relative">
                        {poi.photoUrls && poi.photoUrls.length > 0 ? (
                          <img 
                            src={poi.photoUrls[0]} 
                            alt={poi.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                          {poi.hasPhoto && (
                            <span className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                              <ImagePlus className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                          {poi.hasDescription && (
                            <span className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
                              <FileText className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-100 truncate">{poi.name}</h3>
                            {poi.description && (
                              <p className="text-sm text-gray-400 line-clamp-1 mt-0.5">
                                {poi.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPoi(poi);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-all"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            
                            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${sourceInfo.color}`}>
                              <SourceIcon className="w-3 h-3" />
                              {sourceInfo.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          {poi.category && (
                            <span className="px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                              {poi.category}
                              {poi.subcategory && ` • ${poi.subcategory}`}
                            </span>
                          )}
                          
                          {poi.averageRating !== undefined && poi.averageRating > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              {poi.averageRating.toFixed(1)}
                            </span>
                          )}
                          
                          {poi.checkInCount !== undefined && poi.checkInCount > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              {poi.checkInCount}
                            </span>
                          )}

                          {poi.latitude && poi.longitude && (
                            <a
                              href={`https://www.google.com/maps?q=${poi.latitude},${poi.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-forest-400 hover:text-forest-300"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Carte
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                {pagination.totalCount.toLocaleString()} résultat{pagination.totalCount > 1 ? 's' : ''} •
                Page {pagination.page} sur {pagination.totalPages}
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev}
                  className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm ${
                          pageNum === pagination.page
                            ? 'bg-forest-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-750'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasNext}
                  className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Full Edit Modal */}
      {editingPoi && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingPoi(null)}>
          <div 
            className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Modifier POI</h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{editingPoi.id}</p>
              </div>
              <button
                onClick={() => setEditingPoi(null)}
                className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Catégorie</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value, subcategory: '' }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-forest-500 appearance-none cursor-pointer"
                  >
                    <option value="">Sélectionner...</option>
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Sous-catégorie</label>
                  <select
                    value={editForm.subcategory}
                    onChange={(e) => setEditForm(prev => ({ ...prev, subcategory: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-forest-500 appearance-none cursor-pointer"
                  >
                    <option value="">Sélectionner...</option>
                    {(SUBCATEGORIES[editForm.category] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {/* Allow custom value if current subcategory is not in list */}
                    {editForm.subcategory && !SUBCATEGORIES[editForm.category]?.includes(editForm.subcategory) && (
                      <option value={editForm.subcategory}>{editForm.subcategory}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-300">Description</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg transition-all"
                      title="Copier le prompt pour ChatGPT/Claude"
                    >
                      <Copy className="w-3 h-3" />
                      Copier prompt
                    </button>
                    <button
                      onClick={handleEnrichAI}
                      disabled={enrichingAI}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-purple-900/50 text-purple-300 hover:bg-purple-900 rounded-lg transition-all disabled:opacity-50"
                    >
                      {enrichingAI ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Enrichir via AI
                    </button>
                    <button
                      onClick={handleEnrich}
                      disabled={enriching}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-amber-900/50 text-amber-300 hover:bg-amber-900 rounded-lg transition-all disabled:opacity-50"
                    >
                      {enriching ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Wikipedia
                    </button>
                  </div>
                </div>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-forest-500 resize-none"
                  placeholder="Description du lieu..."
                />
              </div>

              {/* Opening Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Horaires d'ouverture</label>
                <input
                  type="text"
                  value={editForm.openingHours}
                  onChange={(e) => setEditForm(prev => ({ ...prev, openingHours: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  placeholder="Ex: Mar-Sam 12h-14h et 19h-22h"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Photos ({editForm.photoUrls.length})</label>
                
                {/* Existing photos */}
                {editForm.photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editForm.photoUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={url} 
                          alt="" 
                          className="w-20 h-20 object-cover rounded-lg border border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => openPhotoViewer(url, index)}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23374151" width="80" height="80"/><text x="50%" y="50%" fill="%239CA3AF" text-anchor="middle" dy=".3em" font-size="10">Error</text></svg>';
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(index);
                          }}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add photo URL */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.newPhotoUrl}
                    onChange={(e) => setEditForm(prev => ({ ...prev, newPhotoUrl: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
                    placeholder="URL de l'image..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPhoto()}
                  />
                  <button
                    onClick={handleAddPhoto}
                    disabled={!editForm.newPhotoUrl.trim()}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all disabled:opacity-50"
                    title="Ajouter URL"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Upload photo file */}
                <div className="mt-3">
                  <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-gray-500 hover:bg-gray-800/50 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        <span className="text-sm text-gray-400">Upload en cours...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-400">Cliquer pour uploader des photos</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadPhoto}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1.5 text-center">JPG, PNG, WebP • Max 5MB par fichier</p>
                </div>
              </div>

              {/* Location */}
              {editingPoi.latitude && editingPoi.longitude && (
                <div className="pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Coordonnées</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {editingPoi.latitude.toFixed(6)}, {editingPoi.longitude.toFixed(6)}
                      </p>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${editingPoi.latitude},${editingPoi.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Voir sur la carte
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex items-center justify-between">
              {/* Delete button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingPoi(null)}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && editingPoi && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Supprimer ce POI ?</h3>
            <p className="text-gray-400 mb-4">
              Êtes-vous sûr de vouloir supprimer <span className="text-gray-200 font-medium">"{editingPoi.name || 'Sans nom'}"</span> ? 
              Cette action est irréversible.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
          onClick={() => setViewingPhoto(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setViewingPhoto(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 rounded-full transition-all"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Navigation buttons */}
          {editForm.photoUrls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/50 rounded-full transition-all"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/50 rounded-full transition-all"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          
          {/* Image */}
          <img 
            src={viewingPhoto} 
            alt="" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Counter */}
          {editForm.photoUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 rounded-full text-white/70 text-sm">
              {viewingPhotoIndex + 1} / {editForm.photoUrls.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
