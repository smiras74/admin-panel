// POI taxonomy — MUST mirror the iOS enums in
// Guide du Detour/Core/Models/POI.swift (POICategory / POISubcategory).
// Any value not listed here is unknown to the app: an unknown category falls
// back to "curiosites", an unknown subcategory disables contextual filtering.

export const CATEGORIES = [
  { value: 'nature', label: 'Nature' },
  { value: 'histoire', label: 'Histoire' },
  { value: 'hedonisme', label: 'Hédonisme' },
  { value: 'curiosites', label: 'Curiosités' },
  { value: 'services', label: 'Services' },
] as const;

export const SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  nature: [
    { value: 'forets', label: 'Forêts' },
    { value: 'lacs', label: 'Lacs' },
    { value: 'montagnes', label: 'Montagnes' },
    { value: 'grottes', label: 'Grottes' },
    { value: 'cascades', label: 'Cascades' },
    { value: 'plages', label: 'Plages' },
    { value: 'panoramas', label: 'Panoramas' },
  ],
  histoire: [
    { value: 'chateaux', label: 'Châteaux' },
    { value: 'ruines', label: 'Ruines' },
    { value: 'eglises', label: 'Églises' },
    { value: 'monuments', label: 'Monuments' },
    { value: 'musees', label: 'Musées' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'artefact', label: 'Artefacts' },
    { value: 'lavoirs', label: 'Lavoirs' },
    { value: 'moulins', label: 'Moulins' },
    { value: 'village_classe', label: 'Village classé' },
  ],
  hedonisme: [
    { value: 'vignobles', label: 'Vignobles' },
    { value: 'brasseries', label: 'Brasseries' },
    { value: 'marches', label: 'Marchés' },
    { value: 'fermes', label: 'Fermes' },
    { value: 'fromageries', label: 'Fromageries' },
    { value: 'gastronomie', label: 'Gastronomie' },
    { value: 'brocantes', label: 'Brocantes' },
    { value: 'chambres_dhotes', label: "Chambres d'hôtes" },
    { value: 'aires_repos', label: 'Aires de repos' },
    { value: 'bars', label: 'Bars' },
  ],
  curiosites: [
    { value: 'abandonne', label: 'Lieux abandonnés' },
    { value: 'legendes', label: 'Légendes' },
    { value: 'street_art', label: 'Street art' },
    { value: 'villages_fantomes', label: 'Villages fantômes' },
    { value: 'insolite', label: 'Insolite' },
    { value: 'evenements', label: 'Événements' },
    { value: 'eoliennes', label: 'Éoliennes' },
  ],
  services: [
    { value: 'fuel', label: 'Carburant' },
    { value: 'charging_station', label: 'Borne électrique' },
    { value: 'camp_site', label: 'Camping' },
    { value: 'caravan_site', label: 'Aire camping-car' },
    { value: 'picnic_site', label: 'Pique-nique' },
  ],
};

export const isKnownCategory = (v?: string) => !!v && CATEGORIES.some(c => c.value === v);
export const isKnownSubcategory = (cat?: string, sub?: string) =>
  !!sub && !!cat && (SUBCATEGORIES[cat] || []).some(s => s.value === sub);
