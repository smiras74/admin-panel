// Firebase Firestore types for Guide du Détour Admin

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarURL?: string;
  createdAt: Date;
  level: number;
  points: number;
  totalCheckIns: number;
  totalKm: number;
  totalKmTraveled: number;
  totalPOIsCreated: number;
  totalRatings: number;
  totalTrips: number;
  visibility: 'public' | 'friends' | 'private';
  role?: 'admin' | 'moderator' | 'user';
}

export interface POI {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geohash?: string;
  category: 'nature' | 'histoire' | 'hedonisme' | 'curiosites';
  subcategory?: string;
  description?: string;
  photoUrls: string[];
  source: 'verified' | 'osm' | 'ugc';
  status?: 'pending' | 'published' | 'rejected';
  // For verified_pois
  averageRating?: number;
  ratingCount?: number;
  checkInCount?: number;
  // For cached_pois
  wikipediaUrl?: string;
  cachedAt?: Date;
  enrichedAt?: Date;
  // For custom_pois
  creatorId?: string;
  createdAt?: Date;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  poiId: string;
  poiName: string;
  comment: string;
  reviewPhotoUrl?: string;
  privacy: 'Tous' | 'Amis';
  status: 'pending' | 'approved' | 'rejected';
  date: Date;
}

export interface ModerationItem {
  id: string;
  poiId: string;
  userId: string;
  type: 'new_poi' | 'edit' | 'report';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  // For edits - store the changes
  changes?: {
    field: 'name' | 'description' | 'photoUrls';
    oldValue: string | string[];
    newValue: string | string[];
  }[];
  // Original POI data for new_poi
  poiData?: Partial<POI>;
}

export interface CheckIn {
  id: string;
  userId: string;
  poiId: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  createdAt: Date;
}

// Dashboard statistics
export interface DashboardStats {
  pendingModeration: number;
  totalUsers: number;
  totalCheckIns: number;
  pendingEdits: number;
  pendingReviews: number;
  totalKilometers: number;
  totalPOIs: {
    verified: number;
    cached: number;
    custom: number;
  };
  waitlistCount: number;
}

// Moderation action
export type ModerationAction = 'approve' | 'reject';

export interface ModerationDecision {
  itemId: string;
  itemType: 'poi' | 'edit' | 'review';
  action: ModerationAction;
  reason?: string;
  moderatorId: string;
  decidedAt: Date;
}
