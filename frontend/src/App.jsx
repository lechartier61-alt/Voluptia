import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const PROFILE_CATEGORIES = [
  'Homme',
  'Femme',
  'Couple',
  'Trans',
  'Trio',
  'Groupe',
];
const REPORT_CATEGORIES_UI = [
  'Comportement inapproprié',
  'Harcèlement ou pression',
  'Faux profil / usurpation',
  'Contenu inapproprié',
  'Mineur suspecté',
  'Spam / arnaque',
  'Autre',
];
const TABS = ['Accueil', 'Découvrir', 'Médias', 'Messages', 'Mon espace'];
const ADMIN_TABS = [...TABS, 'Admin'];
const LEGACY_TAB_PARENT = {
  Recherche: 'Découvrir',
  'Fil d’actualité': 'Découvrir',
  Suivis: 'Découvrir',
  Lieux: 'Découvrir',
  Carte: 'Découvrir',
  Toktak: 'Médias',
  Albums: 'Médias',
  Notifications: 'Messages',
  'Mon profil': 'Mon espace',
  Abonnement: 'Mon espace',
  Confidentialité: 'Mon espace',
  Paramètres: 'Mon espace',
};
const DEFAULT_SUB_TABS = {
  Découvrir: 'Carte',
  Médias: 'Toktak',
  Messages: 'Messages',
  'Mon espace': 'Mon profil',
};
const USER_NAV_SECTIONS = [
  { id: 'home', icon: 'home', title: 'Accueil', tabs: ['Accueil'] },
  { id: 'discover', icon: 'discover', title: 'Découvrir', tabs: ['Découvrir'] },
  { id: 'social', icon: 'messages', title: 'Messages', tabs: ['Messages'] },
  { id: 'account', icon: 'account', title: 'Mon espace', tabs: ['Mon espace'] },
];
const FREE_TABS = ['Accueil', 'Découvrir', 'Messages', 'Mon espace'];
const TAB_ROUTES = {
  Accueil: '/accueil',
  Découvrir: '/decouvrir',
  Médias: '/medias',
  Messages: '/messages',
  'Mon espace': '/mon-espace',
  Admin: '/admin',
  // Fil d’actualité et Suivis ont été retirés du hub Découvrir.
  // Les anciennes URLs /fil-actualite et /suivis restent traitées plus bas comme aliases vers Découvrir.
  Recherche: '/recherche',
  Lieux: '/lieux',
  Carte: '/carte',
  Toktak: '/toktak',
  Albums: '/albums',
  Notifications: '/notifications',
  Abonnement: '/abonnement',
  'Mon profil': '/mon-profil',
  Confidentialité: '/confidentialite',
  Paramètres: '/parametres',
};
const ROUTE_TABS = {
  '/accueil': 'Accueil',
  '/decouvrir': 'Découvrir',
  '/medias': 'Médias',
  '/messages': 'Messages',
  '/mon-espace': 'Mon espace',
  '/admin': 'Admin',
  '/recherche': 'Découvrir',
  '/fil-actualite': 'Découvrir',
  '/suivis': 'Découvrir',
  '/lieux': 'Découvrir',
  '/carte': 'Découvrir',
  '/toktak': 'Médias',
  '/videos': 'Médias',
  '/albums': 'Médias',
  '/notifications': 'Messages',
  '/mon-profil': 'Mon espace',
  '/abonnement': 'Mon espace',
  '/confidentialite': 'Mon espace',
  '/parametres': 'Mon espace',
};
const ROUTE_SUB_TABS = {
  '/recherche': { Découvrir: 'Recherche' },
  '/lieux': { Découvrir: 'Lieux' },
  '/carte': { Découvrir: 'Carte' },
  '/toktak': { Médias: 'Toktak' },
  '/videos': { Médias: 'Toktak' },
  '/albums': { Médias: 'Albums' },
  '/messages': { Messages: 'Messages' },
  '/notifications': { Messages: 'Notifications' },
  '/mon-profil': { 'Mon espace': 'Mon profil' },
  '/abonnement': { 'Mon espace': 'Abonnement' },
  '/confidentialite': { 'Mon espace': 'Confidentialité' },
  '/parametres': { 'Mon espace': 'Paramètres' },
};
function getDefaultSubTabs() {
  return { ...DEFAULT_SUB_TABS };
}
function getTabParent(tab) {
  return LEGACY_TAB_PARENT[tab] || tab;
}
function getSubTabFor(tab) {
  return LEGACY_TAB_PARENT[tab] ? tab : DEFAULT_SUB_TABS[tab];
}
function getTabFromPath(pathname = window.location.pathname) {
  return ROUTE_TABS[pathname] || 'Accueil';
}
function getSubTabsFromPath(pathname = window.location.pathname) {
  return { ...getDefaultSubTabs(), ...(ROUTE_SUB_TABS[pathname] || {}) };
}
function getAuthModeFromPath(pathname = window.location.pathname) {
  return pathname === '/connexion' ? 'login' : 'register';
}
function navigatePath(path) {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
}


const LEGAL_LINKS = [
  { slug: 'mentions-legales', href: '/mentions-legales', label: 'Mentions légales' },
  { slug: 'conditions-generales', href: '/conditions-generales', label: 'CGU / CGV' },
  { slug: 'confidentialite-donnees', href: '/confidentialite-donnees', label: 'Confidentialité' },
  { slug: 'cookies', href: '/cookies', label: 'Cookies' },
  { slug: 'securite-consentement', href: '/securite-consentement', label: 'Sécurité & consentement' },
  { slug: 'conservation-medias', href: '/conservation-medias', label: 'Conservation médias' },
  { slug: 'contact-signalement', href: '/contact-signalement', label: 'Contact / signalement' },
];
const LEGAL_PATHS = Object.fromEntries(LEGAL_LINKS.map((item) => [item.href, item.slug]));
const MEDIA_RETENTION_TEXT = 'Les photos et vidéos supprimées du site sont conservées au maximum 6 mois en archive technique. La suppression définitive des fichiers éligibles se lance manuellement depuis l’administration s’ils ne sont plus affichés sur la plateforme.';
const LEGAL_PUBLIC_PAGES = {
  'mentions-legales': {
    eyebrow: 'Informations obligatoires',
    title: 'Mentions légales',
    intro: 'Ces informations restent visibles depuis le pied de page. Les champs marqués [À VALIDER] doivent être renseignés avec les informations réelles de l’éditeur et validés par un professionnel du droit avant mise en production.',
    sections: [
      { title: 'Éditeur du site', items: ['Nom commercial : Voluptia.', 'Éditeur : [À VALIDER : dénomination sociale], [À VALIDER : forme juridique] au capital de [À VALIDER : montant] €.', 'RCS : [À VALIDER : ville et numéro RCS/SIREN]. Siège social : [À VALIDER : adresse].', 'Directeur de la publication : [À VALIDER : nom]. Email : [À VALIDER : email de contact].', 'Le site est réservé aux personnes majeures qui acceptent la charte de consentement.'] },
      { title: 'Hébergeur', items: ['[À VALIDER : nom de l’hébergeur], [À VALIDER : adresse], [À VALIDER : contact de l’hébergeur].', 'Les accès administrateur sont limités, journalisés et protégés par des mots de passe forts.'] },
      { title: 'Accès adulte', items: ['Voluptia est interdit aux mineurs.', 'Aucun contenu explicite n’est affiché sur la page publique avant inscription, connexion, déclaration de majorité et abonnement.', 'Tout compte suspecté d’être mineur peut être suspendu ou supprimé.'] },
    ],
  },
  'conditions-generales': {
    eyebrow: 'Règles du service',
    title: 'CGU / CGV',
    intro: 'Les conditions générales encadrent l’utilisation du site, les abonnements et les règles de comportement entre membres.',
    sections: [
      { title: 'Utilisation du service', items: ['Compte réservé aux personnes majeures.', 'Pseudo, ville approximative et informations de profil doivent rester sincères.', 'Harcèlement, pression, diffusion non autorisée, usurpation d’identité et contenus illégaux sont interdits.'] },
      { title: 'Abonnements', items: ['Formules affichées avant paiement : 4,99 € / 5 jours, 9,99 € / 30 jours, 20,00 € / 90 jours, 70,00 € / 365 jours (TTC).', 'Le paiement est traité par Stripe ; aucune donnée bancaire n’est stockée par Voluptia. L’accès est activé après confirmation de paiement.', 'La reconduction automatique est désactivée : chaque abonnement est ponctuel et prend fin à son terme.', 'Rétractation : renonciation possible pour un contenu numérique fourni immédiatement avec accord exprès. [À VALIDER : formulation exacte avec un juriste.]'] },
      { title: 'Modération', items: ['L’administration peut retirer un contenu, limiter un compte ou suspendre un accès en cas de risque légal, sécurité ou non-respect de la charte.', 'Les signalements sont priorisés quand ils concernent mineurs, absence de consentement, violence, menace ou contenu intime diffusé sans accord.'] },
    ],
  },
  'confidentialite-donnees': {
    eyebrow: 'RGPD / vie privée',
    title: 'Politique de confidentialité',
    intro: 'Un site de rencontre libertin traite des informations très personnelles : le principe appliqué est la minimisation, la transparence et le contrôle utilisateur.',
    sections: [
      { title: 'Données traitées', items: ['Compte : email, mot de passe haché, date de création et session.', 'Profil : pseudo, âge, ville approximative, préférences, description, médias, interactions et messages.', 'Données sensibles possibles : vie sexuelle/orientation sexuelle ou préférences intimes, uniquement avec acceptation explicite de l’utilisateur.'] },
      { title: 'Finalités', items: ['Créer et sécuriser le compte.', 'Mettre en relation les profils et calculer des distances approximatives par ville.', 'Modérer, prévenir les abus, traiter les signalements et gérer les abonnements.'] },
      { title: 'Droits utilisateurs', items: ['Accès, rectification, suppression, opposition, limitation et portabilité peuvent être demandés via le support.', 'La localisation exacte n’est pas demandée : seules les coordonnées approximatives de la ville servent au rayon kilométrique.', MEDIA_RETENTION_TEXT] },
    ],
  },
  cookies: {
    eyebrow: 'Traceurs',
    title: 'Cookies',
    intro: 'La base actuelle utilise surtout des éléments nécessaires au fonctionnement : session, préférences et installation de l’application.',
    sections: [
      { title: 'Cookies nécessaires', items: ['Ils servent à garder la session, protéger l’accès au compte et mémoriser certains choix utiles.', 'Ils ne nécessitent pas de consentement séparé lorsqu’ils sont strictement nécessaires au service demandé.'] },
      { title: 'Statistiques / publicité', items: ['Aucun cookie publicitaire n’est nécessaire dans cette version.', 'Si des statistiques ou publicités sont ajoutées, un bandeau de choix devra permettre d’accepter, refuser ou modifier le consentement.'] },
    ],
  },
  'securite-consentement': {
    eyebrow: 'Charte libertine',
    title: 'Sécurité & consentement',
    intro: 'Le site repose sur le consentement clair, le respect, le signalement rapide et la confidentialité.',
    sections: [
      { title: 'Consentement', items: ['Un consentement doit être libre, clair, enthousiaste et révocable à tout moment.', 'Un refus ou une absence de réponse doit être respecté immédiatement.', 'Les messages insistants, menaçants, humiliants ou discriminatoires peuvent entraîner une suspension.'] },
      { title: 'Photos et vidéos', items: ['Publier une personne identifiable suppose son accord.', 'Il est interdit de publier, transmettre ou conserver un média intime d’une autre personne sans son autorisation.', MEDIA_RETENTION_TEXT] },
      { title: 'Protection des membres', items: ['Blocage, signalement et support sont disponibles côté utilisateur.', 'Les profils et albums privés restent protégés par autorisation.', 'La distance affichée est approximative et basée sur la ville, pas sur une adresse.'] },
    ],
  },
  'conservation-medias': {
    eyebrow: 'Photos & vidéos',
    title: 'Conservation des médias',
    intro: MEDIA_RETENTION_TEXT,
    sections: [
      { title: 'Médias visibles sur le site', items: ['Les photos/vidéos restent disponibles tant qu’elles sont affichées dans le profil, les albums ou les messages autorisés.', 'Les albums privés ne sont consultables que si l’accès est ouvert ou accordé.'] },
      { title: 'Médias supprimés du site', items: ['Quand un média est retiré du site, il n’est plus affiché aux autres utilisateurs.', 'Une archive technique maximale de 6 mois peut exister pour sécurité, abus, preuve de suppression ou restauration technique.', 'Après 6 mois, le fichier supprimé devient éligible à une purge définitive lancée manuellement par l’administration s’il n’est plus référencé par le site.'] },
      { title: 'Demandes utilisateurs', items: ['Un utilisateur peut demander la suppression de ses données via le support.', 'Une suppression peut être différée uniquement si une obligation légale, une contestation ou un signalement sérieux exige une conservation temporaire.'] },
    ],
  },
  'contact-signalement': {
    eyebrow: 'Aide',
    title: 'Contact / signalement',
    intro: 'Le signalement doit être simple, visible et traité en priorité lorsqu’il touche à la sécurité ou au consentement.',
    sections: [
      { title: 'Contacter Voluptia', items: ['Email support : [À VALIDER : adresse email officielle de support].', 'Depuis le compte utilisateur : Mon espace → Paramètres → Contacter support.', 'Depuis un profil : utiliser les boutons bloquer/signaler quand disponibles.'] },
      { title: 'À signaler immédiatement', items: ['Mineur ou suspicion de mineur.', 'Média intime diffusé sans autorisation.', 'Harcèlement, menace, chantage, usurpation d’identité ou contenu illicite.'] },
    ],
  },
};
function legalSlugFromPath(pathname = window.location.pathname) {
  return LEGAL_PATHS[pathname] || null;
}
const fallbackOptions = {
  categories: PROFILE_CATEGORIES,
  details: {
    hairColors: ['Non renseigné', 'Noirs', 'Bruns', 'Châtains', 'Blonds', 'Roux', 'Gris', 'Rasés', 'Autre'],
    eyeColors: ['Non renseigné', 'Marron', 'Noisette', 'Verts', 'Bleus', 'Gris', 'Noirs', 'Autre'],
    origins: ['Non renseignée', 'Européenne', 'Africaine', 'Maghrébine', 'Caribéenne', 'Asiatique', 'Latine', 'Métissée', 'Autre'],
    bodyTypes: ['Non renseigné', 'Mince', 'Sportif', 'Normal', 'Pulpeux', 'Rond', 'Athlétique'],
    smokerOptions: ['Non renseigné', 'Non', 'Occasionnel', 'Oui'],
    experienceLevels: ['Non renseigné', 'Découverte', 'Curieux', 'Confirmé', 'Expérimenté'],
    availabilityOptions: ['Libre ce soir', 'Semaine', 'Week-end', 'Soirées', 'Voyages', 'Événements privés'],
    genderOptions: ['Femme', 'Homme', 'Transgenre', 'Non-binaire', 'Autre', 'Non renseigné'],
    sexualOrientations: ['Hétéro', 'Bi', 'Gay', 'Lesbienne', 'Non renseigné'],
  },
};
const SEARCH_RADIUS_MAX_KM = 500;
const DETAIL_FILTER_ALL = 'Tous';
const SEARCH_REGIONS = ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', "Provence-Alpes-Côte d'Azur", 'Wallonie', 'Flandre', 'Bruxelles', 'Suisse romande'];

const defaultFilters = {
  q: '',
  category: DETAIL_FILTER_ALL,
  maxKm: String(SEARCH_RADIUS_MAX_KM),
  minAge: '18',
  maxAge: '65',
  hairColor: DETAIL_FILTER_ALL,
  eyeColor: DETAIL_FILTER_ALL,
  origin: DETAIL_FILTER_ALL,
  online: false,
  verified: false,
  photoOnly: false,
  nearProfile: false,
  freeTonight: false,
  seekTypes: [],
  orientation: DETAIL_FILTER_ALL,
  bodyType: DETAIL_FILTER_ALL,
  hairStyle: DETAIL_FILTER_ALL,
  city: '',
  region: DETAIL_FILTER_ALL,
  meetingTypes: [],
  fetishes: [],
  profileTypes: [],
  minHeight: '',
  maxHeight: '',
  minWeight: '',
  maxWeight: '',
};
const SEARCH_PROFILE_PRESETS = [
  { id: 'toutes_femmes', label: 'Toutes les femmes', category: 'Femme' },
  { id: 'femme_hetero', label: 'Femme hétéro', menuLabel: 'hétéros', category: 'Femme', rules: [{ gender: 'Femme', orientation: 'Hétéro' }] },
  { id: 'femme_bicurieuse', label: 'Femme bi-curieuse', menuLabel: 'bi-curieuses', category: 'Femme', rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'femme_bi', label: 'Femme bi', menuLabel: 'bi', category: 'Femme', rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'femme_lesbienne', label: 'Femme homo', menuLabel: 'homo', category: 'Femme', rules: [{ gender: 'Femme', orientation: 'Lesbienne' }] },
  { id: 'femme_trans', label: 'Trav/trans femme', menuLabel: 'trav/trans', category: 'Trans', rules: [{ gender: 'Transgenre' }] },

  { id: 'tous_hommes', label: 'Tous les hommes', category: 'Homme' },
  { id: 'homme_hetero', label: 'Homme hétéro', menuLabel: 'hétéros', category: 'Homme', rules: [{ gender: 'Homme', orientation: 'Hétéro' }] },
  { id: 'homme_bicurieux', label: 'Homme bi-curieux', menuLabel: 'bi-curieux', category: 'Homme', rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'homme_bi', label: 'Homme bi', menuLabel: 'bi', category: 'Homme', rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'homme_gay', label: 'Homme homo', menuLabel: 'homo', category: 'Homme', rules: [{ gender: 'Homme', orientation: 'Gay' }] },
  { id: 'homme_trans', label: 'Trav/trans homme', menuLabel: 'trav/trans', category: 'Trans', rules: [{ gender: 'Transgenre' }] },
  { id: 'trans_bi', label: 'Trans bi', category: 'Trans', rules: [{ gender: 'Transgenre', orientation: 'Bi' }] },

  { id: 'tous_couples', label: 'Tous les couples', category: 'Couple' },
  { id: 'couple_hf_hetero', label: 'Couple H/F hétéro', category: 'Couple', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Hétéro' }, { gender: 'Homme', orientation: 'Hétéro' }] },
  { id: 'couple_f_hetero', label: 'Couple avec femme hétéro', menuLabel: 'dont femme hétéro', category: 'Couple', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Hétéro' }] },
  { id: 'couple_f_bicurieuse', label: 'Couple avec femme bi-curieuse', menuLabel: 'dont femme bi-curieuse', category: 'Couple', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'couple_f_bi', label: 'Couple avec femme bi', menuLabel: 'dont femme bi', category: 'Couple', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'couple_h_hetero', label: 'Couple avec homme hétéro', menuLabel: 'dont homme hétéro', category: 'Couple', minMembers: 2, rules: [{ gender: 'Homme', orientation: 'Hétéro' }] },
  { id: 'couple_h_bicurieux', label: 'Couple avec homme bi-curieux', menuLabel: 'dont homme bi curieux', category: 'Couple', minMembers: 2, rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'couple_h_bi', label: 'Couple avec homme bi', menuLabel: 'dont homme bi', category: 'Couple', minMembers: 2, rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'couple_bi', label: 'Couple bi', category: 'Couple', minMembers: 2, minOrientationCounts: { Bi: 2 } },
  { id: 'couple_ff', label: 'Couple F/F', category: 'Couple', minMembers: 2, genderCounts: { Femme: 2 } },
  { id: 'couple_hh', label: 'Couple H/H', category: 'Couple', minMembers: 2, genderCounts: { Homme: 2 } },

  { id: 'trio', label: 'Trio', category: 'Trio', minMembers: 3 },
  { id: 'trio_mixte', label: 'Trio mixte', menuLabel: 'mixte', category: 'Trio', minMembers: 3, genderCounts: { Femme: 1, Homme: 1 } },
  { id: 'trio_f_hetero', label: 'Trio avec femme hétéro', menuLabel: 'dont femme hétéro', category: 'Trio', minMembers: 3, rules: [{ gender: 'Femme', orientation: 'Hétéro' }] },
  { id: 'trio_f_bicurieuse', label: 'Trio avec femme bi-curieuse', menuLabel: 'dont femme bi-curieuse', category: 'Trio', minMembers: 3, rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'trio_f_bi', label: 'Trio avec femme bi', menuLabel: 'dont femme bi', category: 'Trio', minMembers: 3, rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'trio_h_hetero', label: 'Trio avec homme hétéro', menuLabel: 'dont homme hétéro', category: 'Trio', minMembers: 3, rules: [{ gender: 'Homme', orientation: 'Hétéro' }] },
  { id: 'trio_h_bicurieux', label: 'Trio avec homme bi-curieux', menuLabel: 'dont homme bi curieux', category: 'Trio', minMembers: 3, rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'trio_h_bi', label: 'Trio avec homme bi', menuLabel: 'dont homme bi', category: 'Trio', minMembers: 3, rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'trio_bi', label: 'Trio bi', category: 'Trio', minMembers: 3, minOrientationCounts: { Bi: 2 } },

  { id: 'groupe', label: 'Groupe', category: 'Groupe', minMembers: 2 },
  { id: 'groupe_mixte', label: 'Groupe mixte', menuLabel: 'mixte', category: 'Groupe', minMembers: 2, genderCounts: { Femme: 1, Homme: 1 } },
  { id: 'groupe_f_hetero', label: 'Groupe avec femme hétéro', menuLabel: 'dont femme hétéro', category: 'Groupe', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Hétéro' }] },
  { id: 'groupe_f_bicurieuse', label: 'Groupe avec femme bi-curieuse', menuLabel: 'dont femme bi-curieuse', category: 'Groupe', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'groupe_f_bi', label: 'Groupe avec femme bi', menuLabel: 'dont femme bi', category: 'Groupe', minMembers: 2, rules: [{ gender: 'Femme', orientation: 'Bi' }] },
  { id: 'groupe_h_hetero', label: 'Groupe avec homme hétéro', menuLabel: 'dont homme hétéro', category: 'Groupe', minMembers: 2, rules: [{ gender: 'Homme', orientation: 'Hétéro' }] },
  { id: 'groupe_h_bicurieux', label: 'Groupe avec homme bi-curieux', menuLabel: 'dont homme bi curieux', category: 'Groupe', minMembers: 2, rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'groupe_h_bi', label: 'Groupe avec homme bi', menuLabel: 'dont homme bi', category: 'Groupe', minMembers: 2, rules: [{ gender: 'Homme', orientation: 'Bi' }] },
  { id: 'groupe_bi', label: 'Groupe bi', category: 'Groupe', minMembers: 2, minOrientationCounts: { Bi: 2 } },
];

const SEARCH_PROFILE_GROUPS = [
  { id: 'couples', icon: '⚥', main: 'tous_couples', children: ['couple_f_hetero', 'couple_f_bicurieuse', 'couple_f_bi', 'couple_h_hetero', 'couple_h_bicurieux', 'couple_h_bi', 'couple_bi', 'couple_ff', 'couple_hh'] },
  { id: 'femmes', icon: '♀', main: 'toutes_femmes', children: ['femme_hetero', 'femme_bicurieuse', 'femme_bi', 'femme_lesbienne', 'femme_trans'] },
  { id: 'hommes', icon: '♂', main: 'tous_hommes', children: ['homme_hetero', 'homme_bicurieux', 'homme_bi', 'homme_gay', 'homme_trans'] },
  { id: 'trios', icon: '▵', main: 'trio', title: 'Tous les trios', children: ['trio_mixte', 'trio_f_hetero', 'trio_f_bicurieuse', 'trio_f_bi', 'trio_h_hetero', 'trio_h_bicurieux', 'trio_h_bi', 'trio_bi'] },
  { id: 'groupes', icon: '✦', main: 'groupe', title: 'Tous les groupes', children: ['groupe_mixte', 'groupe_f_hetero', 'groupe_f_bicurieuse', 'groupe_f_bi', 'groupe_h_hetero', 'groupe_h_bicurieux', 'groupe_h_bi', 'groupe_bi'] },
];

const SEARCH_WANTED_PRESETS = [
  { id: 'want_couples', label: 'Tous les couples', tokens: ['couple', 'couples'] },
  { id: 'want_couple_f_hetero', label: 'Couple avec femme hétéro', menuLabel: 'dont femme hétéro', tokens: ['femme hetero', 'femme hétéro', 'couple femme hetero', 'couple femme hétéro'] },
  { id: 'want_couple_f_bicurieuse', label: 'Couple avec femme bi-curieuse', menuLabel: 'dont femme bi-curieuse', tokens: ['femme bi-curieuse', 'femme bicurieuse', 'femme bi curieuse'] },
  { id: 'want_couple_f_bi', label: 'Couple avec femme bi', menuLabel: 'dont femme bi', tokens: ['femme bi', 'femmes bi'] },
  { id: 'want_couple_h_hetero', label: 'Couple avec homme hétéro', menuLabel: 'dont homme hétéro', tokens: ['homme hetero', 'homme hétéro', 'couple homme hetero'] },
  { id: 'want_couple_h_bicurieux', label: 'Couple avec homme bi-curieux', menuLabel: 'dont homme bi curieux', tokens: ['homme bi-curieux', 'homme bicurieux', 'homme bi curieux'] },
  { id: 'want_couple_h_bi', label: 'Couple avec homme bi', menuLabel: 'dont homme bi', tokens: ['homme bi', 'hommes bi'] },
  { id: 'want_couple_bi', label: 'Couple bi', tokens: ['couple bi', 'couples bi'] },
  { id: 'want_couple_ff', label: 'Couple F/F', tokens: ['couple ff', 'couple f/f', 'couple femmes'] },
  { id: 'want_couple_hh', label: 'Couple H/H', tokens: ['couple hh', 'couple h/h', 'couple hommes'] },

  { id: 'want_femmes', label: 'Toutes les femmes', tokens: ['femme', 'femmes'] },
  { id: 'want_femme_hetero', label: 'Femme hétéro', menuLabel: 'hétéros', tokens: ['femme hetero', 'femme hétéro', 'femmes hetero'] },
  { id: 'want_femme_bicurieuse', label: 'Femme bi-curieuse', menuLabel: 'bi-curieuses', tokens: ['femme bi-curieuse', 'femme bicurieuse', 'femme bi curieuse'] },
  { id: 'want_femme_bi', label: 'Femme bi', menuLabel: 'bi', tokens: ['femme bi', 'femmes bi'] },
  { id: 'want_femme_homo', label: 'Femme homo', menuLabel: 'homo', tokens: ['femme lesbienne', 'femme homo', 'femmes homo'] },
  { id: 'want_femme_trans', label: 'Trav/trans femme', menuLabel: 'trav/trans', tokens: ['trans', 'trav', 'transgenre'] },

  { id: 'want_hommes', label: 'Tous les hommes', tokens: ['homme', 'hommes'] },
  { id: 'want_homme_hetero', label: 'Homme hétéro', menuLabel: 'hétéros', tokens: ['homme hetero', 'homme hétéro', 'hommes hetero'] },
  { id: 'want_homme_bicurieux', label: 'Homme bi-curieux', menuLabel: 'bi-curieux', tokens: ['homme bi-curieux', 'homme bicurieux', 'homme bi curieux'] },
  { id: 'want_homme_bi', label: 'Homme bi', menuLabel: 'bi', tokens: ['homme bi', 'hommes bi'] },
  { id: 'want_homme_homo', label: 'Homme homo', menuLabel: 'homo', tokens: ['homme gay', 'homme homo', 'hommes homo'] },
  { id: 'want_homme_trans', label: 'Trav/trans homme', menuLabel: 'trav/trans', tokens: ['trans', 'trav', 'transgenre'] },

  { id: 'want_trios', label: 'Tous les trios', tokens: ['trio', 'trios'] },
  { id: 'want_trio_mixte', label: 'Trio mixte', menuLabel: 'mixte', tokens: ['trio mixte'] },
  { id: 'want_trio_f_bicurieuse', label: 'Trio avec femme bi-curieuse', menuLabel: 'dont femme bi-curieuse', tokens: ['trio femme bi-curieuse', 'trio femme bi curieuse', 'femme bi-curieuse'] },
  { id: 'want_trio_f_bi', label: 'Trio avec femme bi', menuLabel: 'dont femme bi', tokens: ['trio femme bi', 'femme bi'] },
  { id: 'want_trio_h_bicurieux', label: 'Trio avec homme bi-curieux', menuLabel: 'dont homme bi curieux', tokens: ['trio homme bi-curieux', 'trio homme bi curieux', 'homme bi-curieux'] },
  { id: 'want_trio_h_bi', label: 'Trio avec homme bi', menuLabel: 'dont homme bi', tokens: ['trio homme bi', 'homme bi'] },
  { id: 'want_trio_bi', label: 'Trio bi', tokens: ['trio bi'] },

  { id: 'want_groupes', label: 'Tous les groupes', tokens: ['groupe', 'groupes'] },
  { id: 'want_groupe_mixte', label: 'Groupe mixte', menuLabel: 'mixte', tokens: ['groupe mixte'] },
  { id: 'want_groupe_f_bicurieuse', label: 'Groupe avec femme bi-curieuse', menuLabel: 'dont femme bi-curieuse', tokens: ['groupe femme bi-curieuse', 'groupe femme bi curieuse', 'femme bi-curieuse'] },
  { id: 'want_groupe_f_bi', label: 'Groupe avec femme bi', menuLabel: 'dont femme bi', tokens: ['groupe femme bi', 'femme bi'] },
  { id: 'want_groupe_h_bicurieux', label: 'Groupe avec homme bi-curieux', menuLabel: 'dont homme bi curieux', tokens: ['groupe homme bi-curieux', 'groupe homme bi curieux', 'homme bi-curieux'] },
  { id: 'want_groupe_h_bi', label: 'Groupe avec homme bi', menuLabel: 'dont homme bi', tokens: ['groupe homme bi', 'homme bi'] },
  { id: 'want_groupe_bi', label: 'Groupe bi', tokens: ['groupe bi'] },
];

const SEARCH_WANTED_GROUPS = [
  { id: 'want_couples_group', icon: '⚥', main: 'want_couples', children: ['want_couple_f_hetero', 'want_couple_f_bicurieuse', 'want_couple_f_bi', 'want_couple_h_hetero', 'want_couple_h_bicurieux', 'want_couple_h_bi', 'want_couple_bi', 'want_couple_ff', 'want_couple_hh'] },
  { id: 'want_femmes_group', icon: '♀', main: 'want_femmes', children: ['want_femme_hetero', 'want_femme_bicurieuse', 'want_femme_bi', 'want_femme_homo', 'want_femme_trans'] },
  { id: 'want_hommes_group', icon: '♂', main: 'want_hommes', children: ['want_homme_hetero', 'want_homme_bicurieux', 'want_homme_bi', 'want_homme_homo', 'want_homme_trans'] },
  { id: 'want_trios_group', icon: '▵', main: 'want_trios', children: ['want_trio_mixte', 'want_trio_f_bicurieuse', 'want_trio_f_bi', 'want_trio_h_bicurieux', 'want_trio_h_bi', 'want_trio_bi'] },
  { id: 'want_groupes_group', icon: '✦', main: 'want_groupes', children: ['want_groupe_mixte', 'want_groupe_f_bicurieuse', 'want_groupe_f_bi', 'want_groupe_h_bicurieux', 'want_groupe_h_bi', 'want_groupe_bi'] },
];

const SEARCH_SAVED_KEY = 'voluptia_saved_searches_v143';
const NEAR_PROFILE_MAX_KM = 50;
const PROFILE_LOCK_DURATIONS = [
  { label: '1h', seconds: 60 * 60 },
  { label: '2h', seconds: 2 * 60 * 60 },
  { label: '5h', seconds: 5 * 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '1 semaine', seconds: 7 * 24 * 60 * 60 },
  { label: '30 jours', seconds: 30 * 24 * 60 * 60 },
  { label: 'Infini', seconds: null },
];
const COMMENT_QUICK_EMOJIS = ['🔥', '😍', '👏', '❤️', '✨', '😉'];
const MEDIA_REACTION_OPTIONS = [
  { id: 'heart', emoji: '❤️', label: 'J’aime' },
  { id: 'fire', emoji: '🔥', label: 'Canon' },
  { id: 'wow', emoji: '😍', label: 'Waouh' },
  { id: 'clap', emoji: '👏', label: 'Bravo' },
  { id: 'eyes', emoji: '👀', label: 'Intrigué' },
];
const ICEBREAKER_OPTIONS = ['Tu es libre ce soir ?', 'On discute un peu ?', 'Qu’est-ce que tu recherches ici ?', 'Tu préfères commencer par discuter ou voir les albums ?'];

const NOTIFICATION_PREFERENCE_ITEMS = [
  { key: 'messages', label: 'Messages privés', description: 'Messages, conversations et chats instantanés.' },
  { key: 'likes', label: 'Likes & coups de cœur', description: 'Likes médias, coups de cœur et matchs.' },
  { key: 'comments', label: 'Commentaires', description: 'Commentaires et réponses sur vos médias.' },
  { key: 'albums', label: 'Albums privés', description: 'Demandes d’accès, ouvertures et retraits.' },
  { key: 'follows', label: 'Suivis', description: 'Nouveaux profils qui vous suivent.' },
  { key: 'support', label: 'Support', description: 'Messages envoyés par l’administration.' },
];
const DEFAULT_NOTIFICATION_PREFERENCES = Object.fromEntries(NOTIFICATION_PREFERENCE_ITEMS.map((item) => [item.key, true]));
function getBrowserNotificationStatus() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const permission = supported ? window.Notification.permission : 'unsupported';
  return { supported, permission, enabled: supported && permission === 'granted' };
}

// --- Web Push : abonnement du navigateur aux notifications serveur ---
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (getBrowserNotificationStatus().permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await apiFetch('/push/public-key');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await apiFetch('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
  return true;
}

async function removePushSubscription() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  try { await apiFetch('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }) }); } catch {}
  await subscription.unsubscribe().catch(() => null);
}

// Compatibilité tests V59 après réorganisation V65 : const bottomTabs = ['Accueil', 'Recherche', 'Toktak', 'Messages', 'Mon profil'];
// Compatibilité tests V59 après réorganisation V65 : '/videos': 'Toktak'
const CHAT_EMOJIS = ['😘', '😍', '🔥', '💋', '😉', '❤️', '✨', '🥂', '😈', '🌹', '👌', '💌'];
const CHAT_GIFS = [
  { label: 'Cœur', url: '/gifs/coeur.gif' },
  { label: 'Clin d’œil', url: '/gifs/clin-doeil.gif' },
  { label: 'Flamme', url: '/gifs/flamme.gif' },
  { label: 'Champagne', url: '/gifs/champagne.gif' },
  { label: 'Bisou', url: '/gifs/bisou.gif' },
  { label: 'Étincelle', url: '/gifs/spark.gif' },
];
const CHAT_MEDIA_MAX_BYTES = 7 * 1024 * 1024;
const TOKTAK_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const PWA_INSTALL_DISMISSED_KEY = 'accord_secret_install_dismissed_at';
const PWA_INSTALL_DONE_KEY = 'accord_secret_install_done';
const ONBOARDING_PENDING_KEY = 'accord_secret_onboarding_pending';
const ONBOARDING_DONE_KEY = 'accord_secret_onboarding_done';

function isStandaloneApp() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone
    || document.referrer.startsWith('android-app://')
  );
}

function pwaInstallPlatformHint() {
  const ua = window.navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMac = /macintosh/i.test(ua);
  if (isIOS) return 'Sur iPhone/iPad : bouton Partager → Sur l’écran d’accueil.';
  if (isAndroid) return 'Sur Android : menu du navigateur → Installer l’application ou Ajouter à l’écran d’accueil.';
  if (isMac) return 'Sur Mac : menu du navigateur → Installer Voluptia, ou Partager → Ajouter au Dock selon le navigateur.';
  return 'Sur ordinateur : clique sur l’icône d’installation du navigateur, ou menu → Installer l’application.';
}


function usePwaInstaller(showToast) {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(() => {
    try { return isStandaloneApp() || localStorage.getItem(PWA_INSTALL_DONE_KEY) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    function refreshInstalled() {
      const nextInstalled = isStandaloneApp() || localStorage.getItem(PWA_INSTALL_DONE_KEY) === 'true';
      setInstalled(nextInstalled);
      if (nextInstalled) setInstallEvent(null);
    }
    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
      setInstalled(false);
    }
    function onInstalled() {
      localStorage.setItem(PWA_INSTALL_DONE_KEY, 'true');
      localStorage.removeItem('accord_secret_show_install_tip');
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('voluptia-install-check', refreshInstalled);
    refreshInstalled();
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('voluptia-install-check', refreshInstalled);
    };
  }, []);

  async function installNow() {
    if (isStandaloneApp() || installed) {
      showToast?.('L’application est déjà installée sur cet appareil.');
      return { status: 'installed' };
    }
    if (installEvent?.prompt) {
      installEvent.prompt();
      const choice = await installEvent.userChoice.catch(() => null);
      setInstallEvent(null);
      if (choice?.outcome === 'accepted') {
        localStorage.setItem(PWA_INSTALL_DONE_KEY, 'true');
        localStorage.removeItem('accord_secret_show_install_tip');
        setInstalled(true);
        showToast?.('Installation lancée.');
        return { status: 'accepted' };
      }
      showToast?.('Installation annulée. Vous pouvez réessayer avec le bouton Installer.');
      return { status: 'dismissed' };
    }
    const hint = pwaInstallPlatformHint();
    showToast?.(hint);
    return { status: 'manual', message: hint };
  }

  return {
    installNow,
    available: Boolean(installEvent?.prompt) && !installed,
    installed,
    label: installed ? 'App installée' : 'Installer l’app',
    hint: installed ? 'Application installée sur cet appareil.' : (installEvent ? 'Installation directe disponible.' : pwaInstallPlatformHint()),
  };
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('accord_secret_token') || '';
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-adult-confirmed': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Erreur API');
  return data;
}

async function apiFetchBlobUrl(path) {
  const token = localStorage.getItem('accord_secret_token') || '';
  const url = String(path || '').startsWith('/api/') ? path : `${API_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'x-adult-confirmed': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    let message = 'Média indisponible.';
    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch {}
    throw new Error(message);
  }
  return URL.createObjectURL(await response.blob());
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

function cx(...values) { return values.filter(Boolean).join(' '); }

function AppInstallIcon({ installed = false }) {
  return (
    <svg className="ui-action-icon-v71" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.8" />
      <path d="M10 5.8h4" />
      {installed ? (
        <path className="ui-action-accent-v71" d="M9.4 12.1l1.9 1.9 3.7-4" />
      ) : (
        <>
          <path className="ui-action-accent-v71" d="M12 8.5v6" />
          <path className="ui-action-accent-v71" d="M9.6 12.6L12 15l2.4-2.4" />
        </>
      )}
      <circle cx="12" cy="18.2" r=".55" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="ui-action-icon-v71" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10.8 4.4H6.6a2.2 2.2 0 0 0-2.2 2.2v10.8a2.2 2.2 0 0 0 2.2 2.2h4.2" />
      <path className="ui-action-accent-v71" d="M13 8l4 4-4 4" />
      <path className="ui-action-accent-v71" d="M8.8 12H17" />
    </svg>
  );
}

function InstallButtonContent({ installed = false, compact = false }) {
  return (
    <span className="ui-action-content-v71">
      <AppInstallIcon installed={installed} />
      <span>{installed ? (compact ? 'Installée' : 'App installée') : (compact ? 'Installer' : 'Installer l’app')}</span>
    </span>
  );
}

function LogoutButtonContent() {
  return (
    <span className="ui-action-content-v71">
      <LogoutIcon />
      <span>Déconnexion</span>
    </span>
  );
}

// --- Jeu d'icônes vectorielles cohérent (remplace les glyphes Unicode) ---
const ICON_PATHS = {
  home: <><path d="M4 11.2 12 4.5l8 6.7" /><path d="M5.6 9.9v8.4a1.2 1.2 0 0 0 1.2 1.2h10.4a1.2 1.2 0 0 0 1.2-1.2V9.9" /><path d="M9.8 19.5v-4.4a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1v4.4" /></>,
  discover: <><circle cx="11" cy="11" r="6.3" /><path d="m20 20-4.2-4.2" /></>,
  search: <><circle cx="11" cy="11" r="6.3" /><path d="m20 20-4.2-4.2" /></>,
  media: <><rect x="3.4" y="5" width="17.2" height="14" rx="2.4" /><path d="m10.3 9.4 4.6 2.6-4.6 2.6z" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>,
  video: <><rect x="3.4" y="5" width="17.2" height="14" rx="2.4" /><path d="m10.3 9.4 4.6 2.6-4.6 2.6z" /></>,
  messages: <><path d="M5 5.2h14a1.5 1.5 0 0 1 1.5 1.5v8.6a1.5 1.5 0 0 1-1.5 1.5H9.4L5.5 20v-3.2H5a1.5 1.5 0 0 1-1.5-1.5V6.7A1.5 1.5 0 0 1 5 5.2Z" /></>,
  account: <><circle cx="12" cy="8.4" r="3.6" /><path d="M5.4 19.2a6.6 6.6 0 0 1 13.2 0" /></>,
  profile: <><circle cx="12" cy="8.4" r="3.6" /><path d="M5.4 19.2a6.6 6.6 0 0 1 13.2 0" /></>,
  feed: <><rect x="4" y="4.4" width="16" height="15.2" rx="2.2" /><path d="M7.4 8.6h9.2" /><path d="M7.4 12h9.2" /><path d="M7.4 15.4h5.6" /></>,
  follow: <><path d="M12 19.2 4.6 12a4.3 4.3 0 0 1 6.1-6.1l1.3 1.3 1.3-1.3a4.3 4.3 0 0 1 6.1 6.1Z" /></>,
  heart: <><path d="M12 19.2 4.6 12a4.3 4.3 0 0 1 6.1-6.1l1.3 1.3 1.3-1.3a4.3 4.3 0 0 1 6.1 6.1Z" /></>,
  places: <><path d="M12 21.2c4-3.7 6.2-6.9 6.2-9.9A6.2 6.2 0 0 0 5.8 11.3c0 3 2.2 6.2 6.2 9.9Z" /><circle cx="12" cy="11" r="2.3" /></>,
  albums: <><rect x="3.6" y="3.6" width="11" height="11" rx="2" /><path d="M7.6 18.4h11a1.8 1.8 0 0 0 1.8-1.8v-9" /></>,
  notifications: <><path d="M6.4 17.4V11a5.6 5.6 0 0 1 11.2 0v6.4l1.4 1.6H5Z" /><path d="M10 20.2a2.2 2.2 0 0 0 4 0" /></>,
  alerts: <><path d="M6.4 17.4V11a5.6 5.6 0 0 1 11.2 0v6.4l1.4 1.6H5Z" /><path d="M10 20.2a2.2 2.2 0 0 0 4 0" /></>,
  premium: <><path d="M4.4 8.2 8 11l4-5.4L16 11l3.6-2.8-1.4 9.2H5.8Z" /><path d="M5.8 17.4h12.4" /></>,
  settings: <><circle cx="12" cy="12" r="2.8" /><path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" /></>,
  privacy: <><path d="M12 3.8 5.4 6.6v4.6c0 4 2.8 7.2 6.6 8.4 3.8-1.2 6.6-4.4 6.6-8.4V6.6Z" /><path d="m9.4 11.8 1.9 1.9 3.5-3.7" /></>,
  shield: <><path d="M12 3.8 5.4 6.6v4.6c0 4 2.8 7.2 6.6 8.4 3.8-1.2 6.6-4.4 6.6-8.4V6.6Z" /><path d="m9.4 11.8 1.9 1.9 3.5-3.7" /></>,
  admin: <><circle cx="12" cy="12" r="2.8" /><path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" /></>,
  people: <><circle cx="9" cy="9" r="3" /><path d="M3.6 18.4a5.4 5.4 0 0 1 10.8 0" /><path d="M15.6 6.4a3 3 0 0 1 0 5.6" /><path d="M16.4 13.4a5.4 5.4 0 0 1 4 5" /></>,
  overview: <><circle cx="12" cy="12" r="8" /><path d="M12 7.4v4.6l3 2" /></>,
  identity: <><circle cx="12" cy="8.4" r="3.6" /><path d="M5.4 19.2a6.6 6.6 0 0 1 13.2 0" /></>,
  warning: <><path d="M12 4.4 21 19H3Z" /><path d="M12 10v4.4" /><circle cx="12" cy="16.8" r=".5" /></>,
  send: <><path d="M5 5.2h14a1.5 1.5 0 0 1 1.5 1.5v8.6a1.5 1.5 0 0 1-1.5 1.5H9.4L5.5 20v-3.2H5a1.5 1.5 0 0 1-1.5-1.5V6.7A1.5 1.5 0 0 1 5 5.2Z" /></>,
  install: <><path d="M12 4v9" /><path d="m8.4 9.6 3.6 3.6 3.6-3.6" /><path d="M5.4 17.6h13.2" /></>,
  check: <><path d="m5.5 12.5 4 4 9-9" /></>,
  dot: <><circle cx="12" cy="12" r="3.4" /></>,
};

function Icon({ name, className }) {
  const path = ICON_PATHS[name] || ICON_PATHS.dot;
  return (
    <svg className={cx('nav-icon-v101', className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {path}
    </svg>
  );
}

// Logo de marque vectoriel (remplace le glyphe « ♡ »)
function BrandLogo({ className }) {
  return <img className={cx('brand-logo-v101', className)} src="/voluptia-logo.png" alt="Voluptia" />;
}

// --- Contrôleur de modales applicatives (remplace window.confirm/prompt/alert) ---
const dialogController = {
  listener: null,
  subscribe(fn) { this.listener = fn; return () => { if (this.listener === fn) this.listener = null; }; },
  open(config) {
    return new Promise((resolve) => {
      if (!this.listener) { resolve(config.kind === 'confirm' ? window.confirm(config.message) : config.kind === 'prompt' ? window.prompt(config.message, config.defaultValue || '') : true); return; }
      this.listener({ ...config, resolve });
    });
  },
};
function appConfirm(message, { title = 'Confirmation', danger = false, confirmLabel = 'Confirmer', cancelLabel = 'Annuler' } = {}) {
  return dialogController.open({ kind: 'confirm', message, title, danger, confirmLabel, cancelLabel });
}
function appPrompt(message, { title = '', defaultValue = '', confirmLabel = 'Valider', cancelLabel = 'Annuler', inputType = 'text', placeholder = '' } = {}) {
  return dialogController.open({ kind: 'prompt', message, title: title || message, defaultValue, confirmLabel, cancelLabel, inputType, placeholder });
}
function appAlert(message, { title = 'Information', confirmLabel = 'OK' } = {}) {
  return dialogController.open({ kind: 'alert', message, title, confirmLabel });
}

function DialogHost() {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  useEffect(() => dialogController.subscribe((config) => { setDialog(config); setValue(config.defaultValue || ''); }), []);
  useEffect(() => { if (dialog?.kind === 'prompt') { const id = setTimeout(() => inputRef.current?.focus(), 40); return () => clearTimeout(id); } }, [dialog]);
  if (!dialog) return null;
  function close(result) { dialog.resolve(result); setDialog(null); }
  function onKeyDown(event) {
    if (event.key === 'Escape') close(dialog.kind === 'prompt' ? null : false);
    if (event.key === 'Enter' && dialog.kind === 'prompt') close(value);
  }
  const isPrompt = dialog.kind === 'prompt';
  const isAlert = dialog.kind === 'alert';
  return (
    <div className="app-modal-backdrop-v101" onMouseDown={(e) => { if (e.target === e.currentTarget) close(isPrompt ? null : isAlert ? true : false); }} onKeyDown={onKeyDown}>
      <div className={cx('app-modal-v101', dialog.danger && 'danger')} role="dialog" aria-modal="true" aria-label={dialog.title}>
        <h3>{dialog.title}</h3>
        {dialog.message && dialog.message !== dialog.title ? <p>{dialog.message}</p> : (isPrompt ? null : <p>{dialog.message}</p>)}
        {isPrompt ? (
          <input
            ref={inputRef}
            className="app-modal-field-v101"
            type={dialog.inputType || 'text'}
            value={value}
            placeholder={dialog.placeholder || ''}
            onChange={(e) => setValue(e.target.value)}
            data-allow-text-focus="true"
          />
        ) : null}
        <div className="app-modal-actions-v101">
          {!isAlert ? <button type="button" className="ghost-btn" onClick={() => close(isPrompt ? null : false)}>{dialog.cancelLabel || 'Annuler'}</button> : null}
          <button type="button" className={cx('primary-btn', dialog.danger && 'danger-btn')} onClick={() => close(isPrompt ? value : true)}>{dialog.confirmLabel || 'OK'}</button>
        </div>
      </div>
    </div>
  );
}

function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function splitList(value) { return String(value || '').split(',').map((item) => item.trim()).filter(Boolean); }
function listText(value) { return Array.isArray(value) ? value.join(', ') : String(value || ''); }
const SEARCHING_GROUPS = [
  { label: 'Femmes', items: ['Femmes', 'Femmes bi', 'Femmes hétéro', 'Femmes lesbiennes'] },
  { label: 'Hommes', items: ['Hommes', 'Hommes bi', 'Hommes hétéro', 'Hommes gays'] },
  { label: 'Couples', items: ['Couples', 'Couple hétéro', 'Couple femme bi', 'Couple homme bi', 'Couple lesbien (F/F)', 'Couple gay (H/H)'] },
  { label: 'Trans & autres genres', items: ['Femmes trans', 'Hommes trans', 'Personnes trans', 'Non-binaires', 'Travesti(e)s', 'En questionnement'] },
  { label: 'Sexualités', items: ['Personnes pansexuelles', 'Bicurieux(ses)'] },
  { label: 'Formats & sorties', items: ['Plans à plusieurs', 'Groupes', 'Soirées & événements', 'Clubs libertins', 'Discussions / amitié'] },
];
const SEARCHING_OPTIONS = SEARCHING_GROUPS.flatMap((group) => group.items);
function formatDate(value) {
  if (!value) return 'Non défini';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
}
function money(cents = 0) { return `${(Number(cents || 0) / 100).toFixed(2).replace('.', ',')} €`; }
function greetingByHour() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  if (h < 21) return 'Bonne soirée';
  return 'Bonne nuit';
}



function isCoupleCategory(category = '') {
  return normalize(category) === 'couple';
}
function isTrioCategory(category = '') {
  return normalize(category) === 'trio';
}
function isGroupCategory(category = '') {
  return normalize(category) === 'groupe';
}
function isMultiProfileCategory(category = '') {
  return isCoupleCategory(category) || isTrioCategory(category) || isGroupCategory(category);
}
function orientationOptionsForGender(gender = '') {
  const normalized = normalize(gender);
  if (normalized === 'homme') return ['Hétéro', 'Gay', 'Bi', 'Non renseigné'];
  if (normalized === 'femme') return ['Hétéro', 'Lesbienne', 'Bi', 'Non renseigné'];
  if (normalized === 'trans' || normalized === 'transgenre') return ['Hétéro', 'Gay', 'Lesbienne', 'Bi', 'Non renseigné'];
  return ['Hétéro', 'Gay', 'Lesbienne', 'Bi', 'Non renseigné'];
}
function defaultOrientationForGender(gender = '') {
  return 'Non renseigné';
}
function defaultMember(label, gender = 'Non renseigné', baseAge = 28, ageOffset = 0) {
  return {
    label,
    age: Number(baseAge || 28) + ageOffset,
    gender,
    sexualOrientation: defaultOrientationForGender(gender),
    hairColor: 'Non renseigné',
    eyeColor: 'Non renseigné',
    origin: 'Non renseignée',
    bodyType: 'Non renseigné',
    heightCm: '',
    weightKg: '',
  };
}
function defaultMembersForCategory(category = 'Homme', baseAge = 28) {
  const cleanCategory = String(category || 'Homme');
  if (isCoupleCategory(cleanCategory)) {
    return [defaultMember('Partenaire 1', 'Femme', baseAge, 0), defaultMember('Partenaire 2', 'Homme', baseAge, 1)];
  }
  if (isTrioCategory(cleanCategory)) {
    return [1, 2, 3].map((n, index) => defaultMember(`Membre ${n}`, 'Non renseigné', baseAge, index));
  }
  if (isGroupCategory(cleanCategory)) {
    return [1, 2].map((n) => defaultMember(`Membre ${n}`, 'Non renseigné', baseAge, 0));
  }
  const normalized = normalize(cleanCategory);
  const gender = normalized === 'homme' ? 'Homme' : normalized === 'femme' ? 'Femme' : normalized === 'trans' ? 'Transgenre' : 'Non renseigné';
  return [defaultMember('Personne principale', gender, baseAge, 0)];
}
function memberRoleLabel(category = 'Homme', index = 0) {
  if (isCoupleCategory(category)) return `Partenaire ${index + 1}`;
  if (isTrioCategory(category)) return `Personne ${index + 1}`;
  if (isGroupCategory(category)) return `Personne ${index + 1}`;
  return 'Personne principale';
}
function normalizeMembersForForm(members, category, baseAge = 28) {
  const list = Array.isArray(members) && members.length ? members : defaultMembersForCategory(category, baseAge);
  const min = isGroupCategory(category) ? 2 : isTrioCategory(category) ? 3 : isCoupleCategory(category) ? 2 : 1;
  const max = isGroupCategory(category) ? 20 : isTrioCategory(category) ? 3 : isCoupleCategory(category) ? 2 : 1;
  const prepared = list.slice(0, max).map((member, index) => {
    const gender = member.gender || 'Non renseigné';
    const allowedOrientations = orientationOptionsForGender(gender);
    const currentOrientation = member.sexualOrientation || member.orientation || 'Non renseigné';
    return {
      label: memberRoleLabel(category, index),
      age: member.age === '' ? '' : (member.age || baseAge || 28),
      gender,
      sexualOrientation: allowedOrientations.includes(currentOrientation) ? currentOrientation : 'Non renseigné',
      hairColor: member.hairColor || member.details?.hairColor || 'Non renseigné',
      eyeColor: member.eyeColor || member.details?.eyeColor || 'Non renseigné',
      origin: member.origin || member.details?.origin || 'Non renseignée',
      bodyType: member.bodyType || member.details?.bodyType || 'Non renseigné',
      hairStyle: member.hairStyle || member.details?.hairStyle || 'Non renseigné',
      heightCm: member.heightCm || member.details?.heightCm || '',
      weightKg: member.weightKg || member.details?.weightKg || '',
    };
  });
  while (prepared.length < min) {
    const index = prepared.length;
    prepared.push({ ...(defaultMembersForCategory(category, baseAge)[index] || defaultMember(memberRoleLabel(category, index), 'Non renseigné', baseAge)), label: memberRoleLabel(category, index) });
  }
  return prepared;
}
function memberAgeLabel(profile) {
  const members = Array.isArray(profile.members) ? profile.members : [];
  if (!members.length) return profile.age ? `${profile.age} ans` : '';
  if (isCoupleCategory(profile.category || profile.type)) return members.map((m) => `${m.age} ans`).join(' / ');
  if (isTrioCategory(profile.category || profile.type)) return `Trio de ${members.length} personnes`;
  if (isGroupCategory(profile.category || profile.type)) return `Groupe de ${members.length} personnes`;
  return `${members[0]?.age || profile.age} ans`;
}

function createProfileForm(profile = {}) {
  return {
    pseudo: profile.pseudo || '',
    profilePhotoUrl: profile.profilePhotoUrl || '',
    age: profile.age || 18,
    city: profile.city || '',
    category: profile.category || profile.type || 'Homme',
    orientation: profile.orientation || profile.category || profile.type || '',
    headline: profile.headline || '',
    bio: profile.bio || '',
    interests: listText(profile.interests),
    lookingFor: listText(profile.lookingFor),
    limits: listText(profile.limits),
    meetingTypes: Array.isArray(profile.meetingTypes) ? profile.meetingTypes : [],
    fetishes: Array.isArray(profile.fetishes) ? profile.fetishes : [],
    publicPhotos: listText(profile.publicPhotos),
    freeTonight: Boolean(profile.freeTonight || (Array.isArray(profile.details?.availability) && profile.details.availability.includes('Libre ce soir'))),
    members: normalizeMembersForForm(profile.members, profile.category || profile.type || 'Homme', profile.age || 28),
    locationLat: profile.location?.lat || '',
    locationLng: profile.location?.lng || '',
    socialPreferences: {
      heartAllowedGenders: profile.socialPreferences?.heartAllowedGenders || ['Homme', 'Femme', 'Couple', 'Trans', 'Trio', 'Groupe'],
      showProfileViews: profile.socialPreferences?.showProfileViews !== false,
      instantChatEnabled: profile.socialPreferences?.instantChatEnabled !== false,
      messagePermission: profile.socialPreferences?.messagePermission || 'everyone',
      mediaLikePermission: profile.socialPreferences?.mediaLikePermission || 'everyone',
      mediaCommentPermission: profile.socialPreferences?.mediaCommentPermission || 'everyone',
      allowWinks: profile.socialPreferences?.allowWinks !== false,
      allowAlbumRequests: profile.socialPreferences?.allowAlbumRequests !== false,
    },
    details: {
      heightCm: profile.details?.heightCm || '',
      weightKg: profile.details?.weightKg || '',
      hairColor: profile.details?.hairColor || 'Non renseigné',
      eyeColor: profile.details?.eyeColor || 'Non renseigné',
      origin: profile.details?.origin || 'Non renseignée',
      bodyType: profile.details?.bodyType || 'Non renseigné',
      smoker: profile.details?.smoker || 'Non renseigné',
      relationshipStatus: profile.details?.relationshipStatus || '',
      experienceLevel: profile.details?.experienceLevel || 'Non renseigné',
      languages: listText(profile.details?.languages || ['Français']),
      availability: listText(profile.details?.availability || ['Soirées']),
    },
  };
}

function buildProfilePayload(form) {
  return {
    pseudo: form.pseudo,
    profilePhotoUrl: form.profilePhotoUrl,
    age: Number(form.age),
    city: form.city,
    type: form.category,
    category: form.category,
    orientation: form.orientation || form.category,
    headline: form.headline,
    bio: form.bio,
    interests: splitList(form.interests),
    lookingFor: splitList(form.lookingFor),
    limits: splitList(form.limits),
    meetingTypes: Array.isArray(form.meetingTypes) ? form.meetingTypes : [],
    fetishes: Array.isArray(form.fetishes) ? form.fetishes : [],
    publicPhotos: splitList(form.publicPhotos),
    freeTonight: Boolean(form.freeTonight),
    members: normalizeMembersForForm(form.members, form.category, form.age).map((member, index) => ({ ...member, label: memberRoleLabel(form.category, index), age: Number(member.age) || Number(form.age) || 18, heightCm: Number(member.heightCm || 0), weightKg: Number(member.weightKg || 0) })),
    socialPreferences: form.socialPreferences,
    details: {
      ...form.details,
      heightCm: Number(form.details.heightCm || 0),
      weightKg: Number(form.details.weightKg || 0),
      languages: splitList(form.details.languages),
      availability: splitList(form.details.availability),
    },
  };
}

function profileAgeValues(profile) {
  const memberAges = Array.isArray(profile?.members)
    ? profile.members.map((member) => Number(member?.age)).filter((age) => Number.isFinite(age) && age > 0)
    : [];
  const profileAge = Number(profile?.age);
  return memberAges.length ? memberAges : (Number.isFinite(profileAge) && profileAge > 0 ? [profileAge] : []);
}

function profileAgeMatches(profile, minAge, maxAge) {
  const ages = profileAgeValues(profile);
  if (!ages.length) return true;
  const min = Number(minAge || 18);
  const max = Number(maxAge || 99);
  return ages.some((age) => age >= min && age <= max);
}

function profileDetailMatches(profile, key, selected) {
  if (!selected || selected === DETAIL_FILTER_ALL) return true;
  const values = [
    profile?.details?.[key],
    ...(Array.isArray(profile?.members) ? profile.members.map((member) => member?.[key] || member?.details?.[key]) : []),
  ].filter(Boolean);
  return values.some((value) => normalize(value) === normalize(selected));
}

function profileListIncludesAny(profileValues, selected) {
  const sel = Array.isArray(selected) ? selected : [];
  if (!sel.length) return true;
  const have = (Array.isArray(profileValues) ? profileValues : []).map((v) => normalize(v));
  return sel.some((s) => have.includes(normalize(s)));
}

function profileSearchMembers(profile = {}) {
  const members = Array.isArray(profile?.members) && profile.members.length
    ? profile.members
    : defaultMembersForCategory(profile?.category || profile?.type || 'Non renseigné', profile?.age || 28).map((member) => ({
        ...member,
        sexualOrientation: profile?.details?.sexualOrientation || profile?.orientation || member.sexualOrientation,
      }));
  return members.map((member) => ({
    gender: member?.gender || member?.sex || member?.type || 'Non renseigné',
    orientation: member?.sexualOrientation || member?.orientation || profile?.details?.sexualOrientation || profile?.orientation || 'Non renseigné',
  }));
}

function profileCategoryMatchesPreset(profile = {}, preset = {}) {
  if (!preset.category) return true;
  const profileCategory = normalize(profile?.category || profile?.type);
  const presetCategory = normalize(preset.category);
  if (presetCategory === 'trans') return profileCategory === 'trans' || profileSearchMembers(profile).some((member) => normalize(member.gender).includes('trans'));
  return profileCategory === presetCategory;
}

function countSearchMembers(members = [], key, expectedValue) {
  return members.filter((member) => normalize(member?.[key]) === normalize(expectedValue)).length;
}

function profileMatchesSearchPreset(profile = {}, preset = {}) {
  if (!profileCategoryMatchesPreset(profile, preset)) return false;
  const members = profileSearchMembers(profile);
  const minMembersOk = !preset.minMembers || members.length >= Number(preset.minMembers);
  const rulesOk = !Array.isArray(preset.rules) || preset.rules.every((rule) => members.some((member) => (
    (!rule.gender || normalize(member.gender) === normalize(rule.gender) || (normalize(rule.gender) === 'transgenre' && normalize(member.gender).includes('trans')))
    && (!rule.orientation || normalize(member.orientation) === normalize(rule.orientation))
  )));
  const genderCountsOk = Object.entries(preset.genderCounts || {}).every(([gender, min]) => countSearchMembers(members, 'gender', gender) >= Number(min));
  const orientationCountsOk = Object.entries(preset.minOrientationCounts || {}).every(([orientation, min]) => countSearchMembers(members, 'orientation', orientation) >= Number(min));
  return minMembersOk && rulesOk && genderCountsOk && orientationCountsOk;
}

function profileMatchesSelectedTypes(profile = {}, selectedTypes = []) {
  if (!Array.isArray(selectedTypes) || !selectedTypes.length) return true;
  const presets = SEARCH_PROFILE_PRESETS.filter((preset) => selectedTypes.includes(preset.id));
  if (!presets.length) return true;
  return presets.some((preset) => profileMatchesSearchPreset(profile, preset));
}

function profileTypeLabelById(id) {
  return SEARCH_PROFILE_PRESETS.find((preset) => preset.id === id)?.label || id;
}

function wantedTypeLabelById(id) {
  return SEARCH_WANTED_PRESETS.find((preset) => preset.id === id)?.label || id;
}

function profileFreeTonight(profile = {}) {
  const availability = Array.isArray(profile?.details?.availability) ? profile.details.availability : [];
  return Boolean(profile?.freeTonight || availability.some((item) => normalize(item).includes('libre ce soir')));
}

function profileMatchesWantedTypes(profile = {}, selectedTypes = []) {
  if (!Array.isArray(selectedTypes) || !selectedTypes.length) return true;
  const haystack = normalize([
    ...(Array.isArray(profile?.lookingFor) ? profile.lookingFor : splitList(profile?.lookingFor)),
    profile?.headline,
    profile?.bio,
    ...(Array.isArray(profile?.interests) ? profile.interests : splitList(profile?.interests)),
  ].filter(Boolean).join(' '));
  if (!haystack) return true;
  const presets = SEARCH_WANTED_PRESETS.filter((preset) => selectedTypes.includes(preset.id));
  return presets.some((preset) => (preset.tokens || []).some((token) => haystack.includes(normalize(token))));
}

function hasPersonalProfilePhoto(profile) {
  const photo = String(profile?.profilePhotoUrl || '');
  return Boolean(photo && !photo.startsWith('data:image/svg+xml'));
}

function radiusLabel(value) {
  const km = Number(value || SEARCH_RADIUS_MAX_KM);
  return km >= SEARCH_RADIUS_MAX_KM ? `${SEARCH_RADIUS_MAX_KM} km` : `${km} km`;
}

function distanceValue(profile, fallback = 999999) {
  const raw = profile?.distanceKm;
  if (raw === null || raw === undefined || raw === '') return fallback;
  const km = Number(raw);
  return Number.isFinite(km) ? km : fallback;
}

function distanceLabel(profile) {
  const km = distanceValue(profile, null);
  if (km === null) return 'Distance à calculer';
  if (km <= 0) return 'Même ville';
  return `${Math.round(km)} km`;
}

function cityMapUrl(profile) {
  return profile?.cityLocation?.mapUrl || '';
}

function cityMapEmbedUrl(profile) {
  return profile?.cityLocation?.embedUrl || '';
}


function profileCompletionScore(profile = {}) {
  const items = [
    Boolean(profile?.pseudo),
    Boolean(profile?.city),
    Boolean(profile?.profilePhotoUrl),
    Boolean(profile?.bio && String(profile.bio).trim().length >= 25),
    Boolean(Array.isArray(profile?.lookingFor) ? profile.lookingFor.length : String(profile?.lookingFor || '').trim()),
    Boolean(Array.isArray(profile?.interests) ? profile.interests.length : String(profile?.interests || '').trim()),
    Boolean(Array.isArray(profile?.members) && profile.members.some((member) => member?.age || member?.gender || member?.sexuality || member?.hairColor || member?.eyeColor)),
    Boolean(profile?.verified),
  ];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function profileKeywordSet(profile = {}) {
  const values = [
    profile?.category,
    profile?.type,
    profile?.city,
    profile?.details?.sexualOrientation,
    ...(Array.isArray(profile?.lookingFor) ? profile.lookingFor : splitList(profile?.lookingFor)),
    ...(Array.isArray(profile?.interests) ? profile.interests : splitList(profile?.interests)),
    ...(Array.isArray(profile?.members) ? profile.members.flatMap((member) => [member?.gender, member?.sexuality, member?.sexualOrientation, member?.bodyType, member?.hairColor, member?.eyeColor, member?.origin]) : []),
  ].filter(Boolean);
  return new Set(values.map(normalize).filter(Boolean));
}

function stableProfileNudge(profile = {}) {
  const text = String(profile?.id || profile?.pseudo || 'voluptia');
  let total = 0;
  for (let i = 0; i < text.length; i += 1) total += text.charCodeAt(i) * (i + 3);
  return total % 7;
}

function profileCompatibilityScore(profile = {}, me = {}) {
  if (!profile || profile.id === me?.id) return 0;
  let score = 52 + stableProfileNudge(profile);
  if (profile?.city && me?.city && normalize(profile.city) === normalize(me.city)) score += 12;
  const distance = distanceValue(profile, 999999);
  if (distance <= 30) score += 12;
  else if (distance <= 100) score += 8;
  else if (distance <= 250) score += 4;
  const theirKeywords = profileKeywordSet(profile);
  const myKeywords = profileKeywordSet(me);
  const common = [...theirKeywords].filter((item) => myKeywords.has(item));
  score += Math.min(16, common.length * 4);
  if (profile?.online) score += 6;
  if (profile?.verified) score += 5;
  if (profile?.profilePhotoUrl) score += 5;
  if (profile?.mutualHeart) score += 14;
  else if (profile?.likedMe) score += 10;
  if (profile?.blockedByMe || profile?.blockingMe || profile?.hidden) score = Math.min(score, 20);
  return Math.max(0, Math.min(98, Math.round(score)));
}

function profileCompatibilityReasons(profile = {}, me = {}) {
  const reasons = [];
  if (profile?.mutualHeart) reasons.push('Match réciproque');
  else if (profile?.likedMe) reasons.push('Vous a liké');
  if (profile?.city && me?.city && normalize(profile.city) === normalize(me.city)) reasons.push('Même ville');
  else if (Number.isFinite(distanceValue(profile, NaN)) && distanceValue(profile) <= 100) reasons.push('Proche de vous');
  const common = [...profileKeywordSet(profile)].filter((item) => profileKeywordSet(me).has(item));
  if (common.length) reasons.push('Envies similaires');
  if (profile?.verified) reasons.push('Profil vérifié');
  if (!reasons.length) reasons.push('Profil à découvrir');
  return reasons.slice(0, 3);
}

function profileBadgeList(profile = {}) {
  return [
    profile?.mutualHeart ? 'Match' : '',
    !profile?.mutualHeart && profile?.likedMe ? 'Vous a liké' : '',
    profile?.verified ? 'Vérifié' : '',
    profileFreeTonight(profile) ? 'Libre ce soir' : '',
    profile?.isNew || profileCompletionScore(profile) < 55 ? 'Nouveau' : '',
    (profile?.albums || []).some((album) => album.visibility === 'private') ? 'Album privé' : '',
    profile?.premium || profile?.subscriptionActive ? 'Premium' : '',
  ].filter(Boolean).slice(0, 4);
}

function CompatibilityPill({ profile, me, compact = false }) {
  const score = profileCompatibilityScore(profile, me);
  if (!score) return null;
  return <span className={cx('compat-pill-v127', compact && 'compact')}><strong>{score}%</strong><em>compatible</em></span>;
}

function ProfileBadges({ profile, className = '' }) {
  const badges = profileBadgeList(profile);
  if (!badges.length) return null;
  return <div className={cx('profile-badges-v127', className)}>{badges.map((badge) => <span key={badge}>{badge}</span>)}</div>;
}

function profileMatches(profile, filters) {
  const text = normalize([
    profile.pseudo, profile.city, profile.category, profile.orientation, profile.headline, profile.bio,
    profile.ageDisplay, profile.details?.hairColor, profile.details?.eyeColor, profile.details?.origin, ...(profile.details?.availability || []),
    ...(profile.interests || []), ...(profile.lookingFor || []), ...(profile.limits || []),
    ...(profile.members || []).flatMap((member) => [member.gender, member.sexualOrientation, member.hairColor, member.eyeColor, member.origin]),
  ].join(' '));
  const selectedProfileTypes = Array.isArray(filters.profileTypes) ? filters.profileTypes : [];
  const selectedSeekTypes = Array.isArray(filters.seekTypes) ? filters.seekTypes : [];
  return (!selectedProfileTypes.length && filters.category !== DETAIL_FILTER_ALL ? normalize(profile.category || profile.type) === normalize(filters.category) : true)
    && profileMatchesSelectedTypes(profile, selectedProfileTypes)
    && profileMatchesWantedTypes(profile, selectedSeekTypes)
    && (!filters.q || text.includes(normalize(filters.q)))
    && (!filters.nearProfile || distanceValue(profile) <= NEAR_PROFILE_MAX_KM)
    && (!filters.maxKm || distanceValue(profile) <= Number(filters.maxKm))
    && profileAgeMatches(profile, filters.minAge, filters.maxAge)
    && profileDetailMatches(profile, 'hairColor', filters.hairColor)
    && profileDetailMatches(profile, 'eyeColor', filters.eyeColor)
    && profileDetailMatches(profile, 'origin', filters.origin)
    && profileDetailMatches(profile, 'bodyType', filters.bodyType)
    && (!filters.orientation || filters.orientation === DETAIL_FILTER_ALL || (() => {
      const vals = [
        profile?.details?.sexualOrientation,
        profile?.orientation,
        ...(Array.isArray(profile?.members) ? profile.members.map((m) => m?.sexualOrientation || m?.orientation) : []),
      ].filter(Boolean);
      return vals.some((v) => normalize(v) === normalize(filters.orientation));
    })())
    && (!filters.minHeight || (() => {
      const vals = [
        profile?.details?.heightCm,
        ...(Array.isArray(profile?.members) ? profile.members.map((m) => m?.heightCm || m?.details?.heightCm) : []),
      ].filter(Boolean).map(Number).filter(Number.isFinite);
      return vals.length === 0 || vals.some((v) => v >= Number(filters.minHeight));
    })())
    && (!filters.maxHeight || (() => {
      const vals = [
        profile?.details?.heightCm,
        ...(Array.isArray(profile?.members) ? profile.members.map((m) => m?.heightCm || m?.details?.heightCm) : []),
      ].filter(Boolean).map(Number).filter(Number.isFinite);
      return vals.length === 0 || vals.some((v) => v <= Number(filters.maxHeight));
    })())
    && (!filters.minWeight || (() => {
      const vals = [
        profile?.details?.weightKg,
        ...(Array.isArray(profile?.members) ? profile.members.map((m) => m?.weightKg || m?.details?.weightKg) : []),
      ].filter(Boolean).map(Number).filter(Number.isFinite);
      return vals.length === 0 || vals.some((v) => v >= Number(filters.minWeight));
    })())
    && (!filters.maxWeight || (() => {
      const vals = [
        profile?.details?.weightKg,
        ...(Array.isArray(profile?.members) ? profile.members.map((m) => m?.weightKg || m?.details?.weightKg) : []),
      ].filter(Boolean).map(Number).filter(Number.isFinite);
      return vals.length === 0 || vals.some((v) => v <= Number(filters.maxWeight));
    })())
    && (!filters.online || profile.online)
    && (!filters.verified || profile.verified)
    && (!filters.photoOnly || hasPersonalProfilePhoto(profile))
    && profileDetailMatches(profile, 'hairStyle', filters.hairStyle)
    && (!filters.city || normalize(profile.city || '').includes(normalize(filters.city)))
    && (!filters.region || filters.region === DETAIL_FILTER_ALL || normalize(profile.region || '') === normalize(filters.region))
    && profileListIncludesAny(profile.meetingTypes, filters.meetingTypes)
    && profileListIncludesAny(profile.fetishes, filters.fetishes)
    && (!filters.freeTonight || profileFreeTonight(profile));
}

export default function App() {
  useEffect(() => {
    const clearTextFocusOutsideInputs = (event) => {
      const target = event.target;
      const isEditableTarget = target?.closest?.('input, textarea, select, [contenteditable="true"], [data-allow-text-focus="true"]');
      if (isEditableTarget) return;

      const active = document.activeElement;
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
        active.blur();
      }

      const selection = window.getSelection?.();
      if (selection && selection.type === 'Range') selection.removeAllRanges();
    };

    document.addEventListener('pointerdown', clearTextFocusOutsideInputs, true);
    return () => document.removeEventListener('pointerdown', clearTextFocusOutsideInputs, true);
  }, []);

  const influencerRoute = window.location.pathname.match(/^\/influenceur\/([^/]+)/);
  if (influencerRoute) return <InfluencerPublicPage token={decodeURIComponent(influencerRoute[1])} />;
  const publicLegalSlug = legalSlugFromPath();
  if (publicLegalSlug) return <LegalPublicPage initialSlug={publicLegalSlug} />;

  const [token, setToken] = useState(() => localStorage.getItem('accord_secret_token') || '');
  const [options, setOptions] = useState(fallbackOptions);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(() => getTabFromPath());
  const [activeSubTabs, setActiveSubTabs] = useState(() => getSubTabsFromPath());
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pendingConversationId, setPendingConversationId] = useState('');
  const [floatingProfile, setFloatingProfile] = useState(null);
  const [floatingProfileLoading, setFloatingProfileLoading] = useState(false);
  const [profileActionBusy, setProfileActionBusy] = useState({});
  const [matchOverlay, setMatchOverlay] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_PENDING_KEY) === 'true' && localStorage.getItem(ONBOARDING_DONE_KEY) !== 'true';
    } catch {
      return false;
    }
  });
  const profileActionLocksRef = useRef(new Set());

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 3000);
  }

  function navigateToTab(tab) {
    const parent = getTabParent(tab);
    const subTab = getSubTabFor(tab);
    setActiveTab(parent);
    if (subTab) setActiveSubTabs((current) => ({ ...current, [parent]: subTab }));
    navigatePath(TAB_ROUTES[parent] || TAB_ROUTES[tab] || '/accueil');
  }

  function setPageSubTab(parent, subTab) {
    setActiveSubTabs((current) => ({ ...current, [parent]: subTab }));
  }

  async function loadOptions() {
    try {
      const result = await apiFetch('/profile-options');
      setOptions({ categories: result.categories || PROFILE_CATEGORIES, details: result.details || fallbackOptions.details });
    } catch { setOptions(fallbackOptions); }
  }

  async function refresh(refreshOptions = {}) {
    const silent = Boolean(refreshOptions.silent);
    if (!localStorage.getItem('accord_secret_token')) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/bootstrap');
      setData(result);
      setOptions(result.profileOptions || fallbackOptions);
      if (!result.me?.pseudo || !result.me?.profilePhotoUrl) { navigateToTab('Mon profil'); }
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('connexion')) {
        localStorage.removeItem('accord_secret_token');
        localStorage.removeItem('accord_secret_profile_id');
        setToken('');
        setData(null);
      } else {
        setError(err.message || 'Impossible de charger la plateforme.');
      }
    } finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { loadOptions(); }, []);
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath());
      setActiveSubTabs(getSubTabsFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  useEffect(() => { if (token) refresh(); }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    async function syncClientStatus() {
      if (cancelled || !localStorage.getItem('accord_secret_token')) return;
      const notificationStatus = getBrowserNotificationStatus();
      try {
        await apiFetch('/profile/client-status', {
          method: 'POST',
          body: JSON.stringify({
            notificationsSupported: notificationStatus.supported,
            notificationPermission: notificationStatus.permission,
            notificationsEnabled: notificationStatus.enabled,
            appInstalled: isStandaloneApp() || localStorage.getItem(PWA_INSTALL_DONE_KEY) === 'true',
            standalone: isStandaloneApp(),
            platform: window.navigator.userAgentData?.platform || window.navigator.platform || '',
          }),
        });
      } catch {}
    }
    syncClientStatus();
    // Si la permission est déjà accordée, on (ré)active silencieusement l'abonnement
    // push de cet appareil — utile après vidage du cache ou changement de compte.
    ensurePushSubscription().catch(() => null);
    const timer = window.setInterval(syncClientStatus, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [token]);
  useEffect(() => {
    if (!token) return undefined;
    const syncVisible = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('accord_secret_token')) {
        refresh({ silent: true });
      }
    };
    const intervalId = window.setInterval(syncVisible, 90000);
    window.addEventListener('focus', syncVisible);
    document.addEventListener('visibilitychange', syncVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncVisible);
      document.removeEventListener('visibilitychange', syncVisible);
    };
  }, [token]);
  useEffect(() => {
    if (!data) return;
    const availableTabs = data.me?.role === 'admin' ? ADMIN_TABS : TABS;
    if (!availableTabs.includes(activeTab)) {
      navigateToTab('Accueil');
    }
  }, [data?.me?.role, activeTab]);

  async function handleAuthenticated(result) {
    localStorage.setItem('accord_secret_token', result.token);
    localStorage.setItem('accord_secret_profile_id', result.profile.id);
    if (result.isNewAccount) {
      localStorage.setItem(ONBOARDING_PENDING_KEY, 'true');
      localStorage.removeItem(ONBOARDING_DONE_KEY);
      setShowOnboarding(true);
    }
    localStorage.setItem('accord_secret_show_install_tip', 'true');
    window.dispatchEvent(new Event('voluptia-install-check'));
    setToken(result.token);
    navigateToTab('Accueil');
    showToast(result.message || 'Bienvenue dans Voluptia.');
  }

  function closeOnboarding() {
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    localStorage.removeItem(ONBOARDING_PENDING_KEY);
    setShowOnboarding(false);
  }

  async function logout() {
    try {
      if (localStorage.getItem('accord_secret_token')) {
        await apiFetch('/auth/logout', { method: 'POST', body: '{}' });
      }
    } catch {}
    localStorage.removeItem('accord_secret_token');
    localStorage.removeItem('accord_secret_profile_id');
    setToken('');
    setData(null);
    setActiveTab('Accueil');
    navigatePath('/connexion');
  }

  function patchProfileEverywhere(updatedProfile, extra = {}) {
    if (!updatedProfile?.id) return;
    const mergeProfile = (profile) => profile?.id === updatedProfile.id ? { ...profile, ...updatedProfile } : profile;
    const mergeSocialItems = (items = []) => items.map((item) => item?.profile?.id === updatedProfile.id ? { ...item, profile: { ...item.profile, ...updatedProfile } } : item);
    setData((current) => {
      if (!current) return current;
      const next = {
        ...current,
        ...extra,
        profiles: (current.profiles || []).map(mergeProfile),
      };
      const nextSocial = extra.social || current.social;
      if (nextSocial) {
        next.social = {
          ...nextSocial,
          incomingLikes: mergeSocialItems(nextSocial.incomingLikes || []),
          recentViews: mergeSocialItems(nextSocial.recentViews || []),
        };
      }
      next.videoFeed = (next.videoFeed || current.videoFeed || []).map((media) => media?.owner?.id === updatedProfile.id ? { ...media, owner: { ...media.owner, ...updatedProfile } } : media);
      return next;
    });
    setFloatingProfile((current) => current?.id === updatedProfile.id ? { ...current, ...updatedProfile } : current);
  }

  async function runProfileAction(profileId, action) {
    if (!profileId || profileActionLocksRef.current.has(profileId)) return null;
    profileActionLocksRef.current.add(profileId);
    setProfileActionBusy((current) => ({ ...current, [profileId]: true }));
    try {
      return await action();
    } finally {
      profileActionLocksRef.current.delete(profileId);
      setProfileActionBusy((current) => {
        const next = { ...current };
        delete next[profileId];
        return next;
      });
    }
  }

  async function followProfile(profileId) {
    return runProfileAction(profileId, async () => {
      try {
        const result = await apiFetch(`/profiles/${profileId}/follow`, { method: 'POST', body: JSON.stringify({}) });
        if (result.profile) patchProfileEverywhere(result.profile);
        showToast(result.message || 'Action enregistrée.');
        return result;
      } catch (err) {
        showToast(err.message || 'Action impossible.');
        throw err;
      }
    });
  }
  function updateMediaEverywhere(updatedMedia) {
    if (!updatedMedia?.id) return;
    const patchMedia = (media) => (media?.id === updatedMedia.id ? { ...media, ...updatedMedia } : media);
    const patchAlbum = (album) => album ? { ...album, items: Array.isArray(album.items) ? album.items.map(patchMedia) : album.items } : album;
    const patchProfile = (profile) => profile ? {
      ...profile,
      albums: Array.isArray(profile.albums) ? profile.albums.map(patchAlbum) : profile.albums,
      privateAlbum: profile.privateAlbum ? { ...profile.privateAlbum, items: Array.isArray(profile.privateAlbum.items) ? profile.privateAlbum.items.map(patchMedia) : profile.privateAlbum.items } : profile.privateAlbum,
    } : profile;
    setData((current) => current ? {
      ...current,
      me: patchProfile(current.me),
      profiles: Array.isArray(current.profiles) ? current.profiles.map(patchProfile) : current.profiles,
      videoFeed: Array.isArray(current.videoFeed) ? current.videoFeed.map((entry) => ({ ...entry, media: patchMedia(entry.media) })) : current.videoFeed,
    } : current);
    setFloatingProfile((current) => patchProfile(current));
  }

  async function heartProfile(profileId) {
    return runProfileAction(profileId, async () => {
      try {
        const result = await apiFetch(`/profiles/${profileId}/heart`, { method: 'POST', body: JSON.stringify({}) });
        if (result.profile) patchProfileEverywhere(result.profile, result.social ? { social: result.social } : {});
        if (result.matched && result.profile) setMatchOverlay(result.profile);
        showToast(result.message || 'Coup de cœur envoyé.');
        return result;
      } catch (err) {
        showToast(err.message || 'Coup de cœur impossible.');
        throw err;
      }
    });
  }
  async function passProfile(profileId) {
    return runProfileAction(profileId, async () => {
      try {
        const result = await apiFetch(`/profiles/${profileId}/pass`, { method: 'POST', body: JSON.stringify({}) });
        if (result.profile) patchProfileEverywhere(result.profile, result.social ? { social: result.social } : {});
        showToast(result.message || 'Profil ignoré.');
        return result;
      } catch (err) {
        showToast(err.message || 'Action impossible.');
        throw err;
      }
    });
  }
  async function openConversation(profileId) {
    try {
      const result = await apiFetch(`/conversations/${profileId}/open`, { method: 'POST', body: JSON.stringify({}) });
      const openedProfileId = result.conversation?.participant?.id || profileId;
      setPendingConversationId(openedProfileId);
      navigateToTab('Messages');
      await refresh();
      showToast(result.message || 'Conversation permanente ouverte.');
    }
    catch (err) { showToast(err.message || 'Conversation impossible.'); }
  }

  async function openFloatingProfile(profileOrId) {
    const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
    if (!profileId) return;
    setFloatingProfile(typeof profileOrId === 'object' ? profileOrId : { id: profileId, pseudo: 'Profil' });
    setFloatingProfileLoading(true);
    try {
      const result = await apiFetch(`/profiles/${profileId}`);
      setFloatingProfile(result.profile || profileOrId);
    } catch (err) {
      showToast(err.message || 'Profil impossible à ouvrir.');
      if (typeof profileOrId === 'string') setFloatingProfile(null);
    } finally {
      setFloatingProfileLoading(false);
    }
  }

  async function blockProfile(profileId, durationSeconds = null) {
    try {
      const body = durationSeconds ? { durationSeconds } : {};
      const result = await apiFetch(`/profiles/${profileId}/block`, { method: 'POST', body: JSON.stringify(body) });
      showToast(result.message || 'Utilisateur bloqué.');
      setFloatingProfile(null);
      await refresh();
      return result;
    } catch (err) {
      showToast(err.message || 'Blocage impossible.');
      throw err;
    }
  }

  async function unblockProfile(profileId) {
    try {
      const result = await apiFetch(`/profiles/${profileId}/block`, { method: 'DELETE' });
      showToast(result.message || 'Utilisateur débloqué.');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Déblocage impossible.');
    }
  }

  async function reportProfile(profileOrId, source = 'profile') {
    const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
    if (!profileId) return;
    const pseudo = typeof profileOrId === 'object' ? (profileOrId.pseudo || 'ce profil') : 'ce profil';
    const category = await appPrompt(`Choisis une catégorie pour le signalement de ${pseudo} :\n\n${REPORT_CATEGORIES_UI.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\nTu peux écrire le numéro ou le nom.`, { title: 'Signaler un profil', defaultValue: '1', confirmLabel: 'Continuer' });
    if (category === null) return;
    const picked = REPORT_CATEGORIES_UI[Number(String(category).trim()) - 1] || REPORT_CATEGORIES_UI.find((item) => normalize(item) === normalize(category)) || 'Autre';
    const reason = await appPrompt(`Explique ce qui ne va pas avec ${pseudo}. Le message sera envoyé à l’administration.`, { title: `Signalement — ${picked}`, placeholder: 'Décrivez les faits, le contexte, les messages reçus…', confirmLabel: 'Envoyer le signalement' });
    if (reason === null) return;
    const details = reason.trim();
    if (!details) { showToast('Détail du signalement obligatoire.'); return; }
    try {
      const result = await apiFetch('/reports', { method: 'POST', body: JSON.stringify({ targetId: profileId, category: picked, reason: details, source }) });
      showToast(result.message || 'Signalement envoyé à l’administration.');
      return result;
    } catch (err) {
      showToast(err.message || 'Signalement impossible.');
      return null;
    }
  }
  async function likeMedia(mediaId, reaction = 'heart') {
    try {
      const result = await apiFetch(`/media/${mediaId}/reaction`, { method: 'POST', body: JSON.stringify({ reaction }) });
      if (result.media) updateMediaEverywhere(result.media);
      showToast(result.message || 'Réaction mise à jour.');
    }
    catch (err) { showToast(err.message || 'Réaction impossible.'); }
  }
  async function viewMedia(mediaId) {
    try {
      const result = await apiFetch(`/media/${mediaId}/view`, { method: 'POST', body: JSON.stringify({}) });
      if (result.media) updateMediaEverywhere(result.media);
    } catch {
      // Une vue ne doit pas bloquer la lecture vidéo.
    }
  }
  async function shareMedia(mediaId) {
    try {
      const result = await apiFetch(`/media/${mediaId}/share`, { method: 'POST', body: JSON.stringify({}) });
      if (result.media) updateMediaEverywhere(result.media);
    } catch {
      // Le partage natif peut être annulé, on ne gêne pas l’utilisateur.
    }
  }
  async function commentMedia(mediaId, body) {
    try {
      const result = await apiFetch(`/media/${mediaId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
      if (result.media) updateMediaEverywhere(result.media);
      showToast(result.message || 'Commentaire ajouté.');
    }
    catch (err) { showToast(err.message || 'Commentaire impossible.'); }
  }
  async function likeComment(mediaId, commentId) {
    try {
      const result = await apiFetch(`/media/${mediaId}/comments/${commentId}/like`, { method: 'POST', body: JSON.stringify({}) });
      if (result.media) updateMediaEverywhere(result.media);
    } catch (err) {
      showToast(err.message || 'Action commentaire impossible.');
    }
  }
  async function deleteComment(mediaId, commentId) {
    try {
      const result = await apiFetch(`/media/${mediaId}/comments/${commentId}`, { method: 'DELETE' });
      if (result.media) updateMediaEverywhere(result.media);
      showToast(result.message || 'Commentaire supprimé.');
    } catch (err) {
      showToast(err.message || 'Suppression impossible.');
    }
  }
  async function replyComment(mediaId, commentId, body) {
    try {
      const result = await apiFetch(`/media/${mediaId}/comments/${commentId}/reply`, { method: 'POST', body: JSON.stringify({ body }) });
      if (result.media) updateMediaEverywhere(result.media);
      showToast(result.message || 'Réponse ajoutée.');
    } catch (err) {
      showToast(err.message || 'Réponse impossible.');
    }
  }
  async function reportComment(mediaId, commentId) {
    const reason = await appPrompt('Pourquoi signaler ce commentaire ?', { title: 'Signaler le commentaire', placeholder: 'Expliquez brièvement…', confirmLabel: 'Signaler' });
    if (reason === null) return;
    try {
      const result = await apiFetch(`/media/${mediaId}/comments/${commentId}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
      if (result.media) updateMediaEverywhere(result.media);
      showToast(result.message || 'Commentaire signalé.');
    } catch (err) {
      showToast(err.message || 'Signalement impossible.');
    }
  }
  async function pinComment(mediaId, commentId) {
    try {
      const result = await apiFetch(`/media/${mediaId}/comments/${commentId}/pin`, { method: 'POST', body: JSON.stringify({}) });
      if (result.media) updateMediaEverywhere(result.media);
      showToast(result.message || 'Commentaire mis à jour.');
    } catch (err) {
      showToast(err.message || 'Action impossible.');
    }
  }
  function updateFeedPostEverywhere(updatedPost) {
    if (!updatedPost?.id) return;
    setData((current) => {
      if (!current) return current;
      const feedPosts = Array.isArray(current.feedPosts) ? current.feedPosts : [];
      const exists = feedPosts.some((post) => post.id === updatedPost.id);
      return {
        ...current,
        feedPosts: exists
          ? feedPosts.map((post) => (post.id === updatedPost.id ? { ...post, ...updatedPost } : post))
          : [updatedPost, ...feedPosts],
      };
    });
  }

  function removeFeedPostEverywhere(postId) {
    setData((current) => current ? ({ ...current, feedPosts: (current.feedPosts || []).filter((post) => post.id !== postId) }) : current);
  }

  async function publishFeedPost(payload) {
    try {
      const result = await apiFetch('/feed/posts', { method: 'POST', body: JSON.stringify(payload || {}) });
      if (result.post) updateFeedPostEverywhere(result.post);
      showToast(result.message || 'Publication ajoutée au fil.');
      return result.post;
    } catch (err) {
      showToast(err.message || 'Publication impossible.');
      throw err;
    }
  }

  async function likeFeedPost(postId) {
    try {
      const result = await apiFetch(`/feed/posts/${postId}/like`, { method: 'POST', body: JSON.stringify({}) });
      if (result.post) updateFeedPostEverywhere(result.post);
      showToast(result.message || 'Réaction mise à jour.');
      return result.post;
    } catch (err) {
      showToast(err.message || 'Réaction impossible.');
      throw err;
    }
  }

  async function commentFeedPost(postId, body) {
    try {
      const result = await apiFetch(`/feed/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body, text: body }) });
      if (result.post) updateFeedPostEverywhere(result.post);
      showToast(result.message || 'Commentaire ajouté.');
      return result.comment;
    } catch (err) {
      showToast(err.message || 'Commentaire impossible.');
      throw err;
    }
  }

  async function hideFeedPost(postId) {
    try {
      const result = await apiFetch(`/feed/posts/${postId}/hide`, { method: 'POST', body: JSON.stringify({}) });
      removeFeedPostEverywhere(postId);
      showToast(result.message || 'Publication masquée.');
      return result;
    } catch (err) {
      showToast(err.message || 'Action impossible.');
      throw err;
    }
  }

  async function reportFeedPost(postId, reason) {
    try {
      const result = await apiFetch(`/feed/posts/${postId}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
      showToast(result.message || 'Signalement envoyé à l’administration.');
      return result;
    } catch (err) {
      showToast(err.message || 'Signalement impossible.');
      throw err;
    }
  }

  async function reportFeedMediaProfile(profileOrId, reason) {
    const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
    if (!profileId) return null;
    try {
      const result = await apiFetch('/reports', { method: 'POST', body: JSON.stringify({ targetId: profileId, category: 'Contenu inapproprié', reason, source: 'feed_media' }) });
      showToast(result.message || 'Signalement envoyé à l’administration.');
      return result;
    } catch (err) {
      showToast(err.message || 'Signalement impossible.');
      throw err;
    }
  }


  async function favoriteProfile(profileId) {
    try {
      const result = await apiFetch(`/profiles/${profileId}/favorite`, { method: 'POST', body: JSON.stringify({}) });
      showToast(result.message || 'Favori mis à jour.');
      await refresh({ silent: true });
      return result;
    } catch (err) {
      showToast(err.message || 'Favori impossible.');
      return null;
    }
  }
  async function sendIcebreaker(profileId, message = '') {
    const picked = message || await appPrompt('Choisissez ou écrivez un brise-glace :', { title: 'Brise-glace', defaultValue: ICEBREAKER_OPTIONS[1], placeholder: ICEBREAKER_OPTIONS.join(' / '), confirmLabel: 'Envoyer' });
    if (picked === null) return null;
    try {
      const result = await apiFetch(`/profiles/${profileId}/icebreaker`, { method: 'POST', body: JSON.stringify({ message: picked }) });
      showToast('Brise-glace envoyé.');
      await refresh({ silent: true });
      return result;
    } catch (err) {
      showToast(err.message || 'Brise-glace impossible.');
      return null;
    }
  }
  async function discussTonight(profileId) {
    try {
      const result = await apiFetch(`/profiles/${profileId}/discuss-tonight`, { method: 'POST', body: JSON.stringify({}) });
      showToast('Proposition envoyée.');
      await refresh({ silent: true });
      return result;
    } catch (err) {
      showToast(err.message || 'Proposition impossible.');
      return null;
    }
  }
  async function saveSocialPreferences(preferences) {
    try {
      const result = await apiFetch('/profile/social-preferences', { method: 'PUT', body: JSON.stringify(preferences) });
      showToast(result.message || 'Préférences sociales enregistrées.');
      await refresh({ silent: true });
      return result;
    } catch (err) {
      showToast(err.message || 'Enregistrement impossible.');
      throw err;
    }
  }
  async function requestAlbum(profileId, albumId) {
    try { await apiFetch(`/profiles/${profileId}/album-access/request`, { method: 'POST', body: JSON.stringify({ albumId }) }); showToast('Demande envoyée.'); await refresh(); }
    catch (err) { showToast(err.message || 'Demande impossible.'); }
  }
  async function openMyPrivateAlbumToProfile(profileId, durationSeconds = null) {
    try {
      const result = await apiFetch(`/profiles/${profileId}/album-access/open`, { method: 'POST', body: JSON.stringify({ durationSeconds }) });
      showToast(result.message || 'Album privé ouvert à ce profil.');
      await refresh();
      return result;
    } catch (err) {
      showToast(err.message || 'Ouverture de l’album privé impossible.');
      throw err;
    }
  }
  async function exchangePrivateAlbums(profileId, durationSeconds = 24 * 60 * 60) {
    try {
      const result = await apiFetch(`/profiles/${profileId}/album-access/exchange`, { method: 'POST', body: JSON.stringify({ durationSeconds }) });
      showToast(result.message || 'Échange d’albums privés proposé.');
      await refresh();
      return result;
    } catch (err) {
      showToast(err.message || 'Échange impossible.');
      throw err;
    }
  }
  async function activateSubscription(planId, promoCode) {
    try { const result = await apiFetch('/subscriptions/activate', { method: 'POST', body: JSON.stringify({ planId, promoCode }) }); showToast(result.message || 'Abonnement activé.'); await refresh(); navigateToTab('Accueil'); }
    catch (err) { showToast(err.message || 'Abonnement impossible.'); }
  }
  async function startCheckout(planId, promoCode) {
    try {
      const result = await apiFetch('/payments/create-checkout-session', { method: 'POST', body: JSON.stringify({ planId, promoCode }) });
      if (result.checkoutUrl) {
        showToast('Redirection vers le paiement sécurisé…');
        window.location.assign(result.checkoutUrl);
        return;
      }
      showToast('Session de paiement indisponible.');
    } catch (err) {
      showToast(err.message || 'Paiement indisponible pour le moment.');
    }
  }
  async function markNotificationsRead() {
    try { await apiFetch('/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }); await refresh(); }
    catch (err) { showToast(err.message || 'Action impossible.'); }
  }

  async function saveNotificationPreferences(preferences) {
    try {
      const result = await apiFetch('/profile/notification-preferences', { method: 'PUT', body: JSON.stringify({ preferences }) });
      showToast(result.message || 'Préférences enregistrées.');
      await refresh({ silent: true });
      return result;
    } catch (err) {
      showToast(err.message || 'Enregistrement impossible.');
      throw err;
    }
  }

  async function contactSupport(message) {
    try {
      const result = await apiFetch('/support/contact', { method: 'POST', body: JSON.stringify({ message }) });
      showToast(result.message || 'Message envoyé au support.');
      await refresh({ silent: true });
      return result;
    } catch (err) {
      showToast(err.message || 'Message support impossible.');
      throw err;
    }
  }

  // Pages accessibles via lien email, sans être connecté.
  const emailPagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  if (emailPagePath === '/verifier-email' || emailPagePath === '/reinitialiser-mot-de-passe') {
    return <EmailActionPage path={emailPagePath} showToast={showToast} />;
  }

  if (!token) return <AuthGateway options={options} onAuthenticated={handleAuthenticated} showToast={showToast} toast={toast} initialMode={getAuthModeFromPath()} />;

  if (loading) return <AppShell activeTab={activeTab} setActiveTab={setActiveTab} me={data?.me} onLogout={logout} onNavigateTab={navigateToTab} showToast={showToast}><LoadingScreen /></AppShell>;
  if (error) return <AppShell activeTab={activeTab} setActiveTab={setActiveTab} me={data?.me} onLogout={logout} onNavigateTab={navigateToTab} showToast={showToast}><ErrorScreen error={error} onRetry={refresh} /></AppShell>;
  if (!data) return <AppShell activeTab={activeTab} setActiveTab={setActiveTab} me={data?.me} onLogout={logout} onNavigateTab={navigateToTab} showToast={showToast}><LoadingScreen /></AppShell>;

  const hasAccess = data.me?.role === 'admin' || data.subscription?.active;
  const isLocked = !hasAccess && !FREE_TABS.includes(activeTab);
  const tabs = data.me?.role === 'admin' ? ADMIN_TABS : TABS;
  function goTab(tab) {
    navigateToTab(tab);
  }

  return (
    <AppShell activeTab={activeTab} setActiveTab={setActiveTab} me={data.me} onLogout={logout} unread={data.unreadNotifications || 0} notifications={data.notifications || []} messageUnread={(data.conversations || []).reduce((sum, c) => sum + Number(c.unread || 0), 0)} tabs={tabs} onNavigateTab={navigateToTab} showToast={showToast} onReadAllNotifications={markNotificationsRead}>
      {toast ? <div className="toast">{toast}</div> : null}
      <main className={cx('main-zone', isLocked && 'is-paywalled')}>
        <div className="blurred-site">
          {!hasAccess && (activeTab === 'Découvrir' || activeTab === 'Messages') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', margin: '0 0 14px', borderRadius: '14px', background: 'linear-gradient(100deg, rgba(255,143,197,.16), rgba(192,40,111,.12))', border: '1px solid rgba(255,143,197,.32)' }}>
              <span style={{ fontSize: '1.35rem' }}>✨</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '.95rem' }}>Version d’essai gratuite</strong>
                <small style={{ color: '#d8b9c7', fontSize: '.82rem' }}>
                  {activeTab === 'Découvrir'
                    ? `Il vous reste ${data.freeTier?.profileViewsRemaining ?? 0} profil(s) à découvrir sur ${data.freeTier?.windowHours || 48} h. Abonnez-vous pour un accès illimité.`
                    : 'Lecture seule : vous pouvez lire vos messages mais pas répondre. Abonnez-vous pour discuter librement.'}
                </small>
              </div>
              <button type="button" onClick={() => goTab('Abonnement')} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#ff8fc5,#c0286f)', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>S’abonner</button>
            </div>
          ) : null}
          {/* Source-check legacy fragments kept after hub reorganization: <FeedPage profiles={data.profiles} <Messages conversations={data.conversations || []} */}
          {activeTab === 'Accueil' && <UserHomePage data={data} onNavigate={goTab} onOpenOnboarding={() => setShowOnboarding(true)} onPublish={publishFeedPost} onLike={likeFeedPost} onComment={commentFeedPost} onMediaLike={likeMedia} onMediaComment={commentMedia} onHide={hideFeedPost} onReport={reportFeedPost} onReportProfile={reportFeedMediaProfile} onBlock={blockProfile} onMessage={openConversation} onOpenProfile={openFloatingProfile} onRefresh={refresh} showToast={showToast} />}
          {activeTab === 'Découvrir' && <DiscoverHub activeSubTab={activeSubTabs.Découvrir || 'Carte'} onSubTabChange={(tab) => setPageSubTab('Découvrir', tab)} profiles={data.profiles} profileMap={data.profileMap || data.profiles} me={data.me} social={data.social || {}} grantedByMe={data.grantedByMe || []} options={options} conversations={data.conversations || []} subscription={data.subscription} videos={data.videoFeed || []} onView={viewMedia} onShare={shareMedia} onRefresh={refresh} onFollow={followProfile} onHeart={heartProfile} onPass={passProfile} onMessage={openConversation} onOpenProfile={openFloatingProfile} onOpenPrivateAlbum={openMyPrivateAlbumToProfile} onExchangePrivateAlbums={exchangePrivateAlbums} onBlock={blockProfile} onUnblock={unblockProfile} onRequestAlbum={requestAlbum} onReport={reportProfile} onLike={likeMedia} onComment={commentMedia} onCommentLike={likeComment} onCommentDelete={deleteComment} onCommentReply={replyComment} onCommentReport={reportComment} onCommentPin={pinComment} onNavigate={goTab} showToast={showToast} />}
          {activeTab === 'Médias' && <MediaHub activeSubTab={activeSubTabs.Médias || 'Toktak'} onSubTabChange={(tab) => setPageSubTab('Médias', tab)} videos={data.videoFeed || []} profiles={data.profiles} me={data.me} onLike={likeMedia} onView={viewMedia} onShare={shareMedia} onComment={commentMedia} onCommentLike={likeComment} onCommentDelete={deleteComment} onCommentReply={replyComment} onCommentReport={reportComment} onCommentPin={pinComment} onOpenProfile={openFloatingProfile} onRefresh={refresh} showToast={showToast} onRequestAlbum={requestAlbum} />}
          {activeTab === 'Messages' && <MessagesHub activeSubTab={activeSubTabs.Messages || 'Messages'} canReply={hasAccess} onSubTabChange={(tab) => setPageSubTab('Messages', tab)} conversations={data.conversations || []} profiles={data.profiles || []} me={data.me} showToast={showToast} activeProfileId={pendingConversationId} onConversationOpened={() => setPendingConversationId('')} notifications={data.notifications || []} onReadAll={markNotificationsRead} onOpenProfile={openFloatingProfile} onReport={reportProfile} onNavigate={goTab} social={data.social || {}} onFollow={followProfile} onMessage={openConversation} onBlock={blockProfile} />}
          {activeTab === 'Mon espace' && <AccountHub activeSubTab={activeSubTabs['Mon espace'] || 'Mon profil'} onSubTabChange={(tab) => setPageSubTab('Mon espace', tab)} me={data.me} options={options} onSaved={refresh} showToast={showToast} plans={data.subscriptionPlans || []} subscription={data.subscription} onActivate={activateSubscription} onCheckout={startCheckout} blockedProfiles={data.blockedProfiles || []} onUnblock={unblockProfile} onSaveNotificationPreferences={saveNotificationPreferences} onSaveSocialPreferences={saveSocialPreferences} onContactSupport={contactSupport} />}
          {activeTab === 'Admin' && <AdminPage showToast={showToast} />}
        </div>
        {isLocked ? <PaywallOverlay plans={data.subscriptionPlans || []} onOpenSubscription={() => goTab('Abonnement')} /> : null}
      </main>
      {matchOverlay ? (
        <MatchOverlay
          profile={matchOverlay}
          onClose={() => setMatchOverlay(null)}
          onMessage={() => { const id = matchOverlay.id; setMatchOverlay(null); openConversation(id); }}
          onViewProfile={() => { const profile = matchOverlay; setMatchOverlay(null); openFloatingProfile(profile); }}
        />
      ) : null}
      {floatingProfile ? (
        <SocialProfileModal
          profile={floatingProfile}
          me={data.me}
          loading={floatingProfileLoading}
          onClose={() => setFloatingProfile(null)}
          onFollow={followProfile}
          onHeart={() => heartProfile(floatingProfile.id)}
          onPass={() => passProfile(floatingProfile.id)}
          onMessage={() => { openConversation(floatingProfile.id); setFloatingProfile(null); }}
          onBlock={() => blockProfile(floatingProfile.id)}
          onRequestAlbum={requestAlbum}
          onOpenPrivateAlbum={openMyPrivateAlbumToProfile}
          onExchangePrivateAlbums={exchangePrivateAlbums}
          onReport={reportProfile}
          onFavorite={() => favoriteProfile(floatingProfile.id)}
          onIcebreaker={(message) => sendIcebreaker(floatingProfile.id, message)}
          onDiscussTonight={() => discussTonight(floatingProfile.id)}
        />
      ) : null}
      {showOnboarding && data.me?.role !== 'admin' ? (
        <OnboardingTour
          me={data.me}
          onNavigate={goTab}
          onSkip={closeOnboarding}
          onFinish={closeOnboarding}
        />
      ) : null}
      <DialogHost />
    </AppShell>
  );
}


function OnboardingTour({ me, onNavigate, onSkip, onFinish }) {
  const firstName = me?.pseudo || '';

  // Avancement réel du profil, calculé à partir des données de l'utilisateur.
  const checklist = useMemo(() => ([
    { key: 'photo', label: 'Photo de profil', done: Boolean(me?.profilePhotoUrl) },
    { key: 'city', label: 'Ville renseignée', done: Boolean(me?.city) },
    { key: 'album', label: 'Un premier album', done: Boolean(me?.albums?.length) },
    { key: 'verified', label: 'Profil vérifié', done: Boolean(me?.verified || me?.verificationRequest) },
  ]), [me?.profilePhotoUrl, me?.city, me?.albums?.length, me?.verified, me?.verificationRequest]);
  const doneCount = checklist.filter((c) => c.done).length;
  const completion = Math.round((doneCount / checklist.length) * 100);

  const steps = useMemo(() => ([
    {
      kind: 'intro',
      icon: '✨',
      title: firstName ? `Bienvenue, ${firstName} !` : 'Bienvenue sur Voluptia !',
      body: 'Voluptia, c’est un espace pour faire de belles rencontres en toute confiance. Ce petit guide vous montre l’essentiel en moins d’une minute — et vous pouvez le quitter quand vous voulez.',
      showCompletion: true,
    },
    {
      kind: 'spotlight',
      target: 'section-account',
      tab: 'Mon profil',
      icon: '👤',
      title: 'Soignez votre profil',
      body: 'Une belle photo et quelques mots sincères sur vos envies font toute la différence. Les profils complets reçoivent bien plus de messages — prenez le temps qu’il vous faut, rien n’est figé.',
      tip: 'Un profil vérifié inspire confiance et ressort en priorité dans les recherches.',
      action: 'Compléter mon profil',
      showChecklist: true,
    },
    {
      kind: 'spotlight',
      target: 'section-discover',
      tab: 'Recherche',
      icon: '🔍',
      title: 'Trouvez les bonnes personnes',
      body: 'Laissez-vous porter par les profils suggérés, ou passez en mode Recherche pour filtrer selon vos critères : ville, âge, centres d’intérêt. À vous de choisir le rythme.',
      tip: 'Affinez vos filtres pour des suggestions vraiment à votre goût.',
      action: 'Découvrir des profils',
    },
    {
      kind: 'spotlight',
      target: 'section-media',
      tab: 'Albums',
      icon: '🖼️',
      title: 'Vos photos, vos règles',
      body: 'Partagez des albums publics, ou gardez certaines photos privées et visibles uniquement par les personnes que vous autorisez. Vous gardez le contrôle total, à chaque instant.',
      tip: 'Un album privé se déverrouille d’un simple geste pour la personne de votre choix.',
      action: 'Gérer mes albums',
    },
    {
      kind: 'spotlight',
      target: 'section-social',
      tab: 'Messages',
      icon: '💬',
      title: 'Discutez en toute sérénité',
      body: 'Toutes vos conversations sont réunies ici, avec une alerte dès qu’on vous écrit. Aucune pression : vous répondez quand l’envie vous vient.',
      tip: 'Activez les notifications pour ne manquer aucun message important.',
      action: 'Ouvrir mes messages',
    },
    {
      kind: 'spotlight',
      target: 'section-account',
      tab: 'Paramètres',
      icon: '🛡️',
      title: 'Votre sécurité avant tout',
      body: 'Confidentialité, blocage, signalement, support : tout se règle ici, comme vous le souhaitez. Si quelqu’un dépasse les limites, le signalement est toujours à portée de clic — notre équipe veille.',
      tip: 'Faites vérifier votre profil pour obtenir le badge de confiance.',
      action: 'Voir mes réglages',
    },
    {
      kind: 'finish',
      icon: '🎉',
      title: 'Tout est prêt !',
      body: firstName
        ? `C’est à vous de jouer, ${firstName}. L’étape la plus efficace pour commencer : compléter votre profil pour attirer les bonnes rencontres.`
        : 'C’est à vous de jouer. L’étape la plus efficace pour commencer : compléter votre profil pour attirer les bonnes rencontres.',
      showCompletion: true,
      finishTab: 'Mon profil',
      finishAction: 'Compléter mon profil',
    },
  ]), [firstName]);

  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const headingRef = useRef(null);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;
  const isFinish = step.kind === 'finish';
  const isSpotlight = step.kind === 'spotlight';

  // Déplace le focus sur le titre à chaque étape (lecteurs d'écran + navigation clavier).
  useEffect(() => {
    const id = window.setTimeout(() => headingRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [stepIndex]);

  // Localise l'élément réel à mettre en surbrillance et calcule sa position.
  useEffect(() => {
    let raf = 0;
    function locate() {
      const selector = `[data-tour="${step.target}"]`;
      const TAB_TO_BOTTOM = { 'Mon profil': 'Mon espace', 'Recherche': 'Découvrir', 'Albums': 'Médias', 'Messages': 'Messages', 'Paramètres': 'Mon espace' };
      const bottomTab = TAB_TO_BOTTOM[step.tab] || step.tab;
      const tabSelector = bottomTab ? `[data-tour-tab="${bottomTab}"]` : null;
      let el = document.querySelector(selector);
      // Repli sur la barre du bas (mobile) si la sidebar est masquée.
      if ((!el || el.getBoundingClientRect().width === 0) && tabSelector) {
        el = document.querySelector(tabSelector);
      }
      if (el && el.getBoundingClientRect().width > 0) {
        const rect = el.getBoundingClientRect();
        const pad = 8;
        setSpotlight({
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          centerY: rect.top + rect.height / 2,
          onLeft: rect.left < window.innerWidth / 2,
          below: rect.top < window.innerHeight / 2,
        });
      } else {
        setSpotlight(null); // élément introuvable : on centrera la bulle
      }
    }
    raf = window.requestAnimationFrame(locate);
    window.addEventListener('resize', locate);
    window.addEventListener('scroll', locate, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', locate);
      window.removeEventListener('scroll', locate, true);
    };
  }, [step.target, step.tab, stepIndex]);

  // Navigation clavier : flèches + Échap.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onSkip?.();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function goNext() {
    if (isFinish) {
      if (step.finishTab) onNavigate?.(step.finishTab);
      onFinish?.();
    } else if (isLast) {
      onFinish?.();
    } else {
      setStepIndex((i) => i + 1);
    }
  }
  function goPrev() {
    if (!isFirst) setStepIndex((i) => i - 1);
  }
  function openTarget() {
    // Emmène l'utilisateur sur la rubrique, puis termine en douceur.
    if (step.tab) onNavigate?.(step.tab);
    onFinish?.();
  }
  // Libellé du bouton principal selon le type d'étape.
  const primaryLabel = isFinish ? step.finishAction : isFirst ? 'Commencer' : 'Suivant';

  // Position de la bulle : à côté de l'élément surligné, sinon centrée.
  const bubbleStyle = spotlight
    ? {
        position: 'fixed',
        top: Math.min(Math.max(spotlight.centerY - 90, 16), window.innerHeight - 280),
        ...(spotlight.onLeft
          ? { left: Math.min(spotlight.left + spotlight.width + 16, window.innerWidth - 360) }
          : { right: Math.min(window.innerWidth - spotlight.left + 16, window.innerWidth - 360) }),
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className={cx('tour-overlay-v90', spotlight && 'has-spotlight')} role="dialog" aria-modal="true" aria-label="Guide de démarrage">
      {/* Voile sombre avec projecteur découpé sur l'élément réel */}
      {spotlight ? (
        <div
          className="tour-spotlight-v90"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : (
        <div className="tour-dim-v90" />
      )}

      <article className="tour-bubble-v90 glass" style={bubbleStyle}>
        <button type="button" className="tour-close-v90" onClick={onSkip} aria-label="Passer le guide">×</button>
        <div className="tour-head-v178">
          <span className="tour-icon-v178" aria-hidden="true">{step.icon}</span>
          <p className="eyebrow">Bienvenue chez Voluptia</p>
        </div>
        <h2 ref={headingRef} tabIndex={-1}>{step.title}</h2>
        <p>{step.body}</p>

        {step.showCompletion ? (
          <div className="tour-completion-v178" aria-label={`Profil complété à ${completion} pour cent`}>
            <div className="tour-completion-top-v178">
              <span>Votre profil</span>
              <strong>{completion}%</strong>
            </div>
            <div className="tour-completion-bar-v178">
              <span style={{ width: `${completion}%` }} />
            </div>
            <p className="tour-completion-hint-v178">
              {completion >= 100 ? 'Bravo, votre profil est complet !' : `Encore ${checklist.length - doneCount} étape${checklist.length - doneCount > 1 ? 's' : ''} pour un profil au top.`}
            </p>
          </div>
        ) : null}

        {step.showChecklist ? (
          <ul className="tour-checklist-v178">
            {checklist.map((item) => (
              <li key={item.key} className={cx(item.done && 'done')}>
                <span className="tour-check-mark-v178" aria-hidden="true">{item.done ? '✓' : ''}</span>
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}

        {step.tip ? (
          <p className="tour-tip-v178"><span aria-hidden="true">💡</span> {step.tip}</p>
        ) : null}

        <div className="tour-progress-v90" aria-label={`Étape ${stepIndex + 1} sur ${steps.length}`}>
          {steps.map((item, index) => (
            <span key={item.title} className={cx(index === stepIndex && 'current', index < stepIndex && 'done')} />
          ))}
        </div>

        <div className="tour-actions-v90">
          <button type="button" className="ghost-btn" onClick={onSkip}>{isFinish ? 'Plus tard' : 'Passer le guide'}</button>
          <div className="tour-actions-right-v90">
            {!isFirst ? <button type="button" className="secondary-btn" onClick={goPrev}>Précédent</button> : null}
            <button type="button" className="primary-btn" onClick={goNext}>{primaryLabel}</button>
          </div>
        </div>

        {isSpotlight && step.tab ? (
          <button type="button" className="tour-jump-v90" onClick={openTarget}>{step.action} →</button>
        ) : null}
      </article>
    </div>
  );
}


function InfluencerPublicPage({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    apiFetch(`/influencer/${encodeURIComponent(token)}`).then(setData).catch((err) => setError(err.message || 'Lien introuvable.'));
  }, [token]);
  return (
    <div className="auth-gateway">
      <section className="auth-hero glass">
        <div>
          <p className="eyebrow">Espace influenceur</p>
          <h1>Suivi de code</h1>
          <p>Ce lien permet uniquement de consulter les statistiques du code. Il ne donne pas accès à l’administration.</p>
        </div>
        <div className="auth-panel glass">
          {error ? <ErrorScreen error={error} onRetry={() => window.location.reload()} /> : null}
          {!error && !data ? <LoadingScreen /> : null}
          {data ? <div className="form-grid one"><h2>{data.influencer.name}</h2><p className="hint">Code : <strong>{data.influencer.code}</strong></p><div className="stats-row"><Stat value={data.stats.useCount} label="utilisations" /><Stat value={data.stats.revenueLabel} label="CA généré" /><Stat value={data.stats.commissionLabel} label="commission 20%" /></div><h3>Dernières utilisations</h3>{data.uses?.length ? data.uses.map((use, index) => <div className="notification-row" key={index}><div><strong>{money(use.amountCents)}</strong><p>Commission {money(use.commissionCents)} • {formatDate(use.createdAt)}</p></div></div>) : <EmptyState title="Aucune utilisation pour l’instant." />}</div> : null}
        </div>
      </section>
    </div>
  );
}



function MatchOverlay({ profile, onClose, onMessage, onViewProfile }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!profile) return null;
  return (
    <div className="match-overlay-v127" role="dialog" aria-modal="true" aria-label="Nouveau match" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <article className="match-card-v127 glass">
        <button type="button" className="match-close-v127" onClick={onClose} aria-label="Fermer">×</button>
        <div className="match-hearts-v127"><span>♥</span><span>♥</span><span>♥</span></div>
        <div className="match-avatars-v127">
          <Avatar profile={profile} large />
        </div>
        <p className="eyebrow">Coup de cœur réciproque</p>
        <h2>C’est un match avec {profile.pseudo || 'ce profil'} !</h2>
        <p>Vous vous êtes likés tous les deux. Lancez la conversation pendant que le feeling est chaud.</p>
        <div className="match-actions-v127">
          <button type="button" className="primary-btn" onClick={onMessage}>Envoyer un message</button>
          <button type="button" className="secondary-btn" onClick={onViewProfile}>Voir le profil</button>
        </div>
      </article>
    </div>
  );
}

function AppShell({ children, activeTab, setActiveTab, me, onLogout, unread = 0, notifications = [], messageUnread = 0, tabs = TABS, onNavigateTab, showToast, onReadAllNotifications }) {
  const [open, setOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const unreadMessages = Number(messageUnread || 0);
  const bottomTabs = ['Accueil', 'Découvrir', 'Médias', 'Messages', 'Mon espace'];
  function go(tab) {
    if (onNavigateTab) onNavigateTab(tab);
    else { setActiveTab(getTabParent(tab)); navigatePath(TAB_ROUTES[getTabParent(tab)] || '/accueil'); }
    setOpen(false);
  }
  function label(tab) { return tab === 'Mon espace' ? 'Profil' : tab; }
  function icon(tab) {
    return ({ Accueil: 'home', Découvrir: 'discover', Médias: 'media', Messages: 'messages', 'Mon espace': 'account', 'Fil d’actualité': 'feed', Recherche: 'search', Albums: 'albums', Toktak: 'video', Notifications: 'notifications', Abonnement: 'premium', 'Mon profil': 'profile', Suivis: 'follow', Confidentialité: 'privacy', Paramètres: 'settings', Admin: 'admin' })[tab] || 'dot';
  }
  function countFor(tab) {
    if (tab === 'Messages') return unreadMessages + Number(unread || 0);
    if (tab === 'Notifications') return Number(unread || 0);
    return 0;
  }
  function badge(tab) {
    const count = countFor(tab);
    return count ? <b>{count}</b> : null;
  }
  const navSections = USER_NAV_SECTIONS
    .map((section) => ({ ...section, tabs: section.tabs.filter((tab) => tabs.includes(tab)) }))
    .filter((section) => section.tabs.length);
  const adminSection = tabs.includes('Admin') ? [{ id: 'admin', icon: 'admin', title: 'Administration', subtitle: 'Gestion & modération', tabs: ['Admin'] }] : [];
  const allSections = [...navSections, ...adminSection];
  const activeSection = allSections.find((section) => section.tabs.includes(activeTab)) || allSections[0];

  return (
    <div className={cx('app-shell luxe-shell voluptia-app pro-user-shell', sideCollapsed && 'side-collapsed')}>
      <aside className={cx('pro-side-nav', sideCollapsed && 'collapsed')} aria-label="Navigation utilisateur">
        <div className="pro-side-top">
          <button type="button" className="pro-side-brand" onClick={() => go('Accueil')} aria-label="Retour à l'accueil utilisateur">
            <span className="brand-mark luxe-mark"><BrandLogo /></span>
            <span className="pro-side-brand-text"><strong>Voluptia</strong><small>ESPACE PRIVÉ</small></span>
          </button>
          <button type="button" className="pro-side-toggle" onClick={() => setSideCollapsed(c => !c)} aria-label={sideCollapsed ? 'Déplier le menu' : 'Réduire le menu'} title={sideCollapsed ? 'Déplier' : 'Réduire'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {sideCollapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        <button type="button" className="pro-member-card glass pro-member-card-btn" aria-label="Aller sur mon profil" onClick={() => go('Mon profil')}>
          <Avatar profile={me} />
          <div className="pro-member-card-text">
            <strong>{me?.pseudo || 'Membre'}</strong>
            <small>Voir mon profil →</small>
          </div>
        </button>

        <nav className="pro-menu" aria-label="Rubriques utilisateur">
          {allSections.map((section) => (
            <section className={cx('pro-menu-section', activeSection?.id === section.id && 'active')} key={section.id} data-tour={`section-${section.id}`}>
              <button type="button" className="pro-section-title" onClick={() => go(section.tabs[0])} aria-current={activeSection?.id === section.id ? 'page' : undefined} title={sideCollapsed ? section.title : undefined}>
                <i><Icon name={section.icon} /></i>
                <span className="pro-section-title-text"><strong>{section.title}</strong>{section.subtitle ? <small>{section.subtitle}</small> : null}</span>
                {badge(section.tabs[0])}
              </button>
              {section.tabs.length > 1 && !sideCollapsed ? (
                <div className="pro-section-links">
                  {section.tabs.map((tab) => (
                    <button type="button" key={tab} data-route={TAB_ROUTES[tab]} className={cx(activeTab === tab && 'active')} onClick={() => go(tab)}>
                      <span><em><Icon name={icon(tab)} /></em>{label(tab)}</span>{badge(tab)}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </nav>

        <div className="pro-side-actions">
          <button type="button" className="small-btn outline-gold full premium-cta-v101" onClick={() => go('Abonnement')} title={sideCollapsed ? 'Pass Premium' : undefined}><Icon name="premium" /><span className="pro-side-action-text">Pass Premium</span></button>
          <button type="button" className="ghost-btn ui-logout-btn-v71 full" onClick={onLogout} title={sideCollapsed ? 'Déconnexion' : undefined}><LogoutButtonContent /></button>
        </div>
      </aside>

      <div className="pro-workspace">
        <header className="pro-topbar" aria-label="En-tête utilisateur">
          <div className="pro-current-section">
            <p className="eyebrow">{activeSection?.title || 'Espace utilisateur'}</p>
            <h1>{activeTab}</h1>
          </div>
          <nav className="pro-section-shortcuts" aria-label="Accès rapides aux rubriques">
            {allSections.map((section) => (
              <button type="button" key={section.id} className={cx(activeSection?.id === section.id && 'active')} onClick={() => go(section.tabs[0])}>
                <i><Icon name={section.icon} /></i><span>{section.title}</span>
              </button>
            ))}
          </nav>
          <div className="top-actions social-top-actions pro-top-actions">
            <NotificationBellMenu unread={Number(unread || 0)} notifications={notifications} onReadAll={onReadAllNotifications} onNavigateTab={go} />
            <button type="button" className={cx('small-btn filled-gold profile-entry', activeTab === 'Mon espace' && 'active')} onClick={() => go('Mon profil')}><Avatar profile={me} />{me?.pseudo || 'Profil'}</button>
            <button type="button" className="menu-toggle" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Ouvrir le menu"><svg className="nav-icon-v101" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg></button>
          </div>
        </header>

        {activeSection?.tabs?.length > 1 ? (
          <nav className="pro-context-nav" aria-label="Sous-catégories de la rubrique active">
            {(activeSection?.tabs || []).map((tab) => (
              <button type="button" key={tab} data-route={TAB_ROUTES[tab]} className={cx(activeTab === tab && 'active')} onClick={() => go(tab)}>
                <i><Icon name={icon(tab)} /></i><span>{tab}</span>{badge(tab)}
              </button>
            ))}
          </nav>
        ) : null}

        {children}
      </div>

      <div className={cx('drawer-backdrop', open && 'open')} onClick={() => setOpen(false)} />
      <aside className={cx('side-drawer', open && 'open', 'social-drawer v28-drawer pro-mobile-drawer')}>
        <div className="drawer-head">
          <div><strong>Voluptia</strong><small>{me?.pseudo || 'Membre'} • espace privé</small></div>
          <button type="button" className="small-btn" onClick={() => setOpen(false)}>Fermer</button>
        </div>
        <nav className="drawer-nav v28-drawer-nav">
          {allSections.map((section) => (
            <section key={section.id}>
              {section.tabs.map((tab) => (
                <button type="button" key={tab} data-route={TAB_ROUTES[tab]} className={cx(activeTab === tab && 'active')} onClick={() => go(tab)}>
                  <span><em><Icon name={icon(tab)} /></em>{tab}</span>{badge(tab)}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <button type="button" className="ghost-btn ui-logout-btn-v71 full" onClick={onLogout}><LogoutButtonContent /></button>
      </aside>

      <nav className="mobile-bottom-nav social-bottom-nav v28-bottom-nav pro-bottom-nav" aria-label="Navigation mobile">
        {bottomTabs.map((tab) => (
          <button type="button" key={tab} data-route={TAB_ROUTES[tab]} data-tour-tab={tab} className={cx(activeTab === tab && 'active')} onClick={() => go(tab)}>
            <i><Icon name={icon(tab)} /></i><span>{label(tab)}</span>{badge(tab)}
          </button>
        ))}
      </nav>
    </div>
  );
}

function NotificationBell({ unread = 0, notifications = [], onClick }) {
  const latest = notifications.find((item) => !item.read) || notifications[0];
  const label = unread ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Aucune notification non lue';
  return (
    <button type="button" className={cx('notification-bell-v68', unread > 0 && 'has-unread')} onClick={onClick} aria-label={label} title={latest?.title || 'Notifications'}>
      <span className="bell-icon-v68" aria-hidden="true">🔔</span>
      {unread ? <b>{unread > 99 ? '99+' : unread}</b> : null}
      <small>{latest?.title || 'Notifications'}</small>
    </button>
  );
}

// Panneau flottant des notifications, ancré à la cloche.
// Toutes les notifications y sont listées ; l'ouverture marque l'ensemble comme lu
// (le surlignage des nouveautés reste visible le temps de la consultation).
function NotificationBellMenu({ unread = 0, notifications = [], onReadAll, onNavigateTab }) {
  const [open, setOpen] = useState(false);
  const [sessionUnreadIds, setSessionUnreadIds] = useState(() => new Set());
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocPointer(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('touchstart', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('touchstart', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        setSessionUnreadIds(new Set(notifications.filter((item) => !item.read).map((item) => item.id)));
        if (unread) onReadAll?.();
      }
      return next;
    });
  }

  function openNotification(notification) {
    const category = notificationCategory(notification);
    const target = category === 'Messages' ? 'Messages' : category === 'Médias' ? 'Médias' : category === 'Rencontres' ? 'Recherche' : 'Notifications';
    setOpen(false);
    onNavigateTab?.(target);
  }

  return (
    <div className="notif-bell-wrap-v152" ref={wrapRef}>
      <NotificationBell unread={unread} notifications={notifications} onClick={toggle} />
      {open ? (
        <div className="notif-dropdown-v152" role="dialog" aria-label="Notifications">
          <div className="notif-dropdown-head-v152">
            <strong>Notifications</strong>
            <span>{unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'À jour'}</span>
            <button type="button" className="small-btn" onClick={() => { setOpen(false); onNavigateTab?.('Notifications'); }}>Tout voir</button>
          </div>
          <div className="notif-dropdown-list-v152">
            {notifications.length ? notifications.map((notification) => (
              <button type="button" key={notification.id} className={cx('notif-dropdown-row-v152', sessionUnreadIds.has(notification.id) && 'unread')} onClick={() => openNotification(notification)}>
                <Avatar profile={notification.actor} />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                  <em>{notificationCategory(notification)} • {formatDate(notification.createdAt)}</em>
                </span>
              </button>
            )) : (
              <p className="notif-dropdown-empty-v152">Aucune notification pour l’instant.<br />Les likes, messages et demandes d’albums apparaîtront ici.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


function EmailActionPage({ path, showToast }) {
  const isVerify = path === '/verifier-email';
  const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '';
  const [status, setStatus] = useState(isVerify ? 'pending' : 'form');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);

  // Vérification d'email : automatique au chargement.
  useEffect(() => {
    if (!isVerify) return;
    if (!token) { setStatus('error'); setMessage('Lien invalide : jeton manquant.'); return; }
    (async () => {
      try {
        const result = await apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
        setStatus('success'); setMessage(result.message || 'Email confirmé.');
      } catch (err) {
        setStatus('error'); setMessage(err.message || 'Lien invalide ou expiré.');
      }
    })();
  }, []);

  async function submitReset(e) {
    e.preventDefault();
    if (password.length < 8) { showToast('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (password !== password2) { showToast('Les deux mots de passe ne correspondent pas.'); return; }
    setBusy(true);
    try {
      const result = await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setStatus('success'); setMessage(result.message || 'Mot de passe mis à jour.');
    } catch (err) {
      showToast(err.message || 'Réinitialisation impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="email-action-page-v99">
      <div className="email-action-card-v99 glass">
        <h1>Voluptia</h1>
        {isVerify ? (
          <>
            {status === 'pending' ? <p>Confirmation de votre email en cours…</p> : null}
            {status === 'success' ? <><div className="email-action-icon-v99 ok">✓</div><h2>Email confirmé</h2><p>{message}</p></> : null}
            {status === 'error' ? <><div className="email-action-icon-v99 err">!</div><h2>Lien invalide</h2><p>{message}</p></> : null}
          </>
        ) : (
          <>
            {status === 'success' ? (
              <><div className="email-action-icon-v99 ok">✓</div><h2>Mot de passe modifié</h2><p>{message}</p></>
            ) : !token ? (
              <><div className="email-action-icon-v99 err">!</div><h2>Lien invalide</h2><p>Jeton manquant.</p></>
            ) : (
              <form onSubmit={submitReset}>
                <h2>Nouveau mot de passe</h2>
                <Field label="Nouveau mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                <Field label="Confirmer" type="password" value={password2} onChange={setPassword2} placeholder="••••••••" />
                <button type="submit" className="landing-btn-primary full" disabled={busy}>{busy ? 'Enregistrement…' : 'Changer mon mot de passe'}</button>
              </form>
            )}
          </>
        )}
        <a href="/" className="email-action-back-v99">Retour à l’accueil</a>
      </div>
    </div>
  );
}

function AuthGateway({ options, onAuthenticated, showToast, toast, initialMode = 'register' }) {
  const [mode, setMode] = useState(initialMode);
  const [authOpen, setAuthOpen] = useState(() => window.location.pathname === '/connexion' || window.location.pathname === '/inscription');
  useEffect(() => {
    setMode(initialMode);
    if (window.location.pathname === '/connexion' || window.location.pathname === '/inscription') setAuthOpen(true);
  }, [initialMode]);

  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [twoFaChallenge, setTwoFaChallenge] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [register, setRegister] = useState({
    email: '', password: '', age: 18, company: '', acceptAdult: false, acceptLegal: false, acceptCharter: false, acceptSensitiveData: false,
    pseudo: '', profilePhotoUrl: '', type: options.categories?.[0] || 'Homme', city: '', bio: '', lookingFor: '', members: defaultMembersForCategory(options.categories?.[0] || 'Homme', 28),
  });
  const loginGoogleButtonRef = useRef(null);
  const registerGoogleButtonRef = useRef(null);
  const googleSubmitRef = useRef(null);
  const authModeRef = useRef(mode);
  const registerRef = useRef(register);
  authModeRef.current = mode;
  registerRef.current = register;

  async function submitGoogleCredential(credential) {
    if (!credential) { showToast('Connexion Google annulée.'); return; }
    setBusy(true);
    try {
      const nextMode = authModeRef.current === 'register' ? 'register' : 'login';
      const body = { credential, mode: nextMode };
      if (nextMode === 'register') {
        const draft = registerRef.current;
        if (!draft.acceptAdult || !draft.acceptLegal || !draft.acceptSensitiveData) throw new Error('Coche la majorité, les documents légaux et les données sensibles avant de continuer avec Google.');
        const started = await apiFetch('/auth/age-verification/start', { method: 'POST', body: JSON.stringify({ age: draft.age }) });
        let ageVerificationToken = started.verification?.token || '';
        const ageVerificationOptional = started.verification?.status === 'not_required' || started.verification?.mode === 'declaration_only';
        if (!ageVerificationToken && started.verification?.mode === 'demo') {
          const confirmed = await apiFetch('/auth/age-verification/demo-confirm', { method: 'POST', body: JSON.stringify({ sessionId: started.verification.sessionId }) });
          ageVerificationToken = confirmed.verification?.token || '';
        }
        if (!ageVerificationToken && !ageVerificationOptional) throw new Error('Vérification d’âge à finaliser avant inscription Google.');
        const normalizedMembers = normalizeMembersForForm(draft.members, draft.type, draft.age);
        const preparedMembers = normalizedMembers.map((member, index) => ({
          ...member,
          label: memberRoleLabel(draft.type, index),
        }));
        body.profile = { ...draft, members: preparedMembers, ageVerificationToken };
      }
      const result = await apiFetch('/auth/google', { method: 'POST', body: JSON.stringify(body) });
      await onAuthenticated({ ...result, isNewAccount: Boolean(result.isNewAccount) });
    } catch (err) {
      showToast(err.message || 'Connexion Google impossible.');
    } finally {
      setBusy(false);
    }
  }
  googleSubmitRef.current = submitGoogleCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    function initGoogle() {
      if (cancelled || !window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => googleSubmitRef.current?.(response?.credential),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setGoogleReady(true);
      } catch (error) {
        console.warn('Google Identity Services init:', error);
      }
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (window.google?.accounts?.id) {
      initGoogle();
    } else if (existing) {
      existing.addEventListener('load', initGoogle, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      script.onerror = () => showToast('Le bouton Google est indisponible pour le moment.');
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReady || !window.google?.accounts?.id) return;
    const target = mode === 'login' ? loginGoogleButtonRef.current : registerGoogleButtonRef.current;
    if (!target) return;
    target.innerHTML = '';
    try {
      window.google.accounts.id.renderButton(target, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
        width: Math.min(360, target.clientWidth || 320),
        locale: 'fr',
      });
    } catch (error) {
      console.warn('Google button render:', error);
    }
  }, [googleReady, mode, authOpen]);

  function openAuth(nextMode) {
    setMode(nextMode);
    setAuthOpen(true);
    navigatePath(nextMode === 'login' ? '/connexion' : '/inscription');
  }

  function closeAuth() {
    setAuthOpen(false);
    navigatePath('/');
  }

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(login) });
      if (result.twoFactorRequired) {
        setTwoFaChallenge(result.challengeToken);
        setTwoFaCode('');
        showToast('Saisissez le code de votre application d’authentification.');
        return;
      }
      await onAuthenticated({ ...result, isNewAccount: false });
    } catch (err) {
      showToast(err.message || 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function submitTwoFa(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await apiFetch('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ challengeToken: twoFaChallenge, code: twoFaCode.trim() }) });
      setTwoFaChallenge(null);
      setTwoFaCode('');
      await onAuthenticated({ ...result, isNewAccount: false });
    } catch (err) {
      showToast(err.message || 'Code de vérification incorrect.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!register.acceptAdult || !register.acceptLegal || !register.acceptSensitiveData) throw new Error('Tu dois confirmer la majorité, accepter les documents légaux et le traitement des données sensibles nécessaires au service.');
      const started = await apiFetch('/auth/age-verification/start', { method: 'POST', body: JSON.stringify({ age: register.age }) });
      let ageVerificationToken = started.verification?.token || '';
      const ageVerificationOptional = started.verification?.status === 'not_required' || started.verification?.mode === 'declaration_only';
      if (!ageVerificationToken && started.verification?.mode === 'demo') {
        const confirmed = await apiFetch('/auth/age-verification/demo-confirm', { method: 'POST', body: JSON.stringify({ sessionId: started.verification.sessionId }) });
        ageVerificationToken = confirmed.verification?.token || '';
      }
      if (!ageVerificationToken && !ageVerificationOptional) throw new Error('Vérification d’âge à finaliser auprès du prestataire avant inscription.');
      const normalizedMembers = normalizeMembersForForm(register.members, register.type, register.age);
      const profilePseudo = String(register.pseudo || '').trim();
      if (!profilePseudo) throw new Error('Le pseudo de la fiche est obligatoire.');
      const isDetailUnset = (value) => !value || /^non renseign/i.test(String(value).trim());
      const incompleteMember = normalizedMembers.some((member) => isDetailUnset(member.sexualOrientation) || isDetailUnset(member.origin) || isDetailUnset(member.bodyType));
      if (incompleteMember) throw new Error('Sexualité, origine et silhouette sont obligatoires pour chaque personne avant l’inscription.');
      const preparedMembers = normalizedMembers.map((member, index) => ({
        ...member,
        label: memberRoleLabel(register.type, index),
        age: Number(member.age) || Number(register.age) || 18,
      }));
      const result = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ ...register, pseudo: profilePseudo, members: preparedMembers, ageVerificationToken }) });
      await onAuthenticated({ ...result, isNewAccount: true });
    } catch (err) {
      showToast(err.message || 'Inscription impossible.');
    } finally {
      setBusy(false);
    }
  }

  const registerDetailsComplete = normalizeMembersForForm(register.members, register.type, register.age)
    .every((member) => !/^non renseign/i.test(String(member.sexualOrientation || '').trim())
      && !/^non renseign/i.test(String(member.origin || '').trim())
      && !/^non renseign/i.test(String(member.bodyType || '').trim()));
  const registerChecklist = [
    { label: 'Connexion', done: Boolean(register.email && register.password) },
    { label: 'Profil', done: Boolean(register.pseudo && register.city && register.type) },
    { label: 'Détails', done: registerDetailsComplete },
    { label: 'Bio', done: Boolean(register.bio || register.lookingFor) },
    { label: 'Accords', done: Boolean(register.acceptAdult && register.acceptLegal && register.acceptSensitiveData) },
  ];
  const registerCompletion = Math.round((registerChecklist.filter((item) => item.done).length / registerChecklist.length) * 100);

  const authContent = (
    <aside className={cx('landing-auth-card floating-auth-card', mode === 'register' && 'floating-auth-card-register')} aria-label={mode === 'login' ? 'Connexion' : 'Inscription'}>
      <button type="button" className="floating-auth-close" onClick={closeAuth} aria-label="Fermer">×</button>
      <div className="landing-auth-head">
        <div className="landing-auth-switch" role="tablist" aria-label="Choisir le mode d’accès">
          <button type="button" className={cx(mode === 'login' && 'active')} onClick={() => openAuth('login')}>Connexion</button>
          <button type="button" className={cx(mode === 'register' && 'active')} onClick={() => openAuth('register')}>Inscription</button>
        </div>
      </div>

      {mode === 'login' ? (twoFaChallenge ? (
        <form className="landing-form" onSubmit={submitTwoFa}>
          <p style={{ color: 'rgba(255,236,230,.78)', fontSize: '.9rem', margin: '0 0 4px' }}>Authentification à deux facteurs activée. Saisissez le code à 6 chiffres de votre application d’authentification (ou un code de secours).</p>
          <Field label="Code de vérification" type="text" value={twoFaCode} onChange={setTwoFaCode} placeholder="123456" />
          <button type="submit" className="landing-btn-primary full" disabled={busy}>{busy ? 'Vérification…' : 'Vérifier'}</button>
          <button type="button" className="landing-btn-outline full" onClick={() => { setTwoFaChallenge(null); setTwoFaCode(''); }}>Annuler</button>
        </form>
      ) : (
        <form className="landing-form" onSubmit={submitLogin}>
          {GOOGLE_CLIENT_ID ? (
            <>
              <div className="google-auth-block"><div ref={loginGoogleButtonRef} className="google-button-slot" aria-label="Se connecter avec Google" /></div>
              <div className="landing-separator google-separator"><span>ou avec email</span></div>
            </>
          ) : null}
          <Field label="Email" type="email" value={login.email} onChange={(value) => setLogin({ ...login, email: value })} placeholder="votre@email.com" />
          <Field label="Mot de passe" type="password" value={login.password} onChange={(value) => setLogin({ ...login, password: value })} placeholder="••••••••" />
          <div className="landing-login-options">
            <label className="landing-check-row" style={{ fontSize: '.88rem' }}><input type="checkbox" defaultChecked /> <span style={{ color: 'rgba(255,236,230,.72)' }}>Se souvenir de moi</span></label>
            <button type="button" onClick={async () => {
              const email = await appPrompt('Entrez votre email pour recevoir un lien de réinitialisation :', { title: 'Mot de passe oublié', defaultValue: login.email || '', inputType: 'email', placeholder: 'votre@email.com', confirmLabel: 'Envoyer le lien' });
              if (email === null) return;
              try {
                const result = await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
                showToast(result.message || 'Si un compte existe, un email a été envoyé.');
              } catch (err) {
                showToast(err.message || 'Demande impossible pour le moment.');
              }
            }} className="landing-forgot-btn-v131">Mot de passe oublié ?</button>
          </div>
          <button type="submit" className="landing-btn-primary full" disabled={busy}>{busy ? 'Connexion en cours…' : 'Se connecter'}</button>
          <button type="button" className="landing-btn-outline full" onClick={() => openAuth('register')}>Créer un compte</button>
          <p className="landing-demo-text">Les comptes fictifs ont été supprimés : connectez-vous avec votre compte ou créez-en un.</p>
        </form>
      )) : (
        <form className="landing-form register register-form-v121" onSubmit={submitRegister}>
          {GOOGLE_CLIENT_ID ? (
            <div className="google-auth-register">
              <div ref={registerGoogleButtonRef} className="google-button-slot" aria-label="S’inscrire avec Google" />
              <p>Complète âge, ville et accords, puis continue avec Google sans mot de passe.</p>
            </div>
          ) : null}
          <div className="register-progress-v121">
            <div><strong>{registerCompletion}%</strong><span>inscription complétée</span></div>
            <i><em style={{ width: `${registerCompletion}%` }} /></i>
            <div className="register-steps-v121">{registerChecklist.map((item) => <span key={item.label} className={cx(item.done && 'done')}>{item.done ? '✓' : '•'} {item.label}</span>)}</div>
          </div>
          <div className="landing-grid-2">
            <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={register.company} onChange={(e) => setRegister({ ...register, company: e.target.value })} style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
            <Field label="Email" type="email" value={register.email} onChange={(value) => setRegister({ ...register, email: value })} placeholder="votre@email.com" />
            <Field label="Mot de passe" type="password" value={register.password} onChange={(value) => setRegister({ ...register, password: value })} placeholder="••••••••" />
          </div>
          <div className="landing-grid-2">
            <Field label="Pseudo de la fiche" value={register.pseudo} onChange={(value) => setRegister({ ...register, pseudo: value })} placeholder="Votre pseudo public" />
            <CityField label="Ville" value={register.city} onChange={(value) => setRegister({ ...register, city: value })} placeholder="Paris, Lyon, Bruxelles…" />
          </div>
          <div className="landing-grid-2">
            <Field label="Âge du profil" type="number" value={register.age} onChange={(value) => setRegister({ ...register, age: value, members: normalizeMembersForForm(register.members, register.type, value) })} />
            <SelectField
              label="Type de profil"
              value={register.type}
              options={options.categories || PROFILE_CATEGORIES}
              onChange={(value) => setRegister({
                ...register,
                type: value,
                members: defaultMembersForCategory(value, register.age),
              })}
            />
          </div>
          <MemberEditor
            title={isCoupleCategory(register.type) ? 'Détails des 2 personnes du couple' : isTrioCategory(register.type) ? 'Détails des 3 personnes du trio' : isGroupCategory(register.type) ? 'Détails des personnes du groupe' : 'Détails de la personne'}
            category={register.type}
            members={register.members}
            options={options}
            requireDetails
            onChange={(members) => setRegister({ ...register, members })}
          />
          <TextareaField label="Bio courte" value={register.bio} onChange={(value) => setRegister({ ...register, bio: value })} />
          <details className="register-search-collapse-v190">
            <summary>
              <span className="field-label-v153">Je recherche</span>
              <small>{splitList(register.lookingFor).length ? `${splitList(register.lookingFor).length} sélectionné(s)` : 'Toucher pour choisir'}</small>
              <i className="chev-v190" aria-hidden="true">⌄</i>
            </summary>
            <div className="register-search-body-v190">
              <p className="chip-hint-v189">Cochez tout ce qui vous intéresse — plusieurs choix possibles.</p>
              {SEARCHING_GROUPS.map((group) => (
                <div className="register-search-group-v190" key={group.label}>
                  <h5>{group.label}</h5>
                  <OptionChips options={group.items} selected={splitList(register.lookingFor)} onToggle={(opt) => {
                    const cur = splitList(register.lookingFor);
                    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
                    setRegister({ ...register, lookingFor: next.join(', ') });
                  }} />
                </div>
              ))}
            </div>
          </details>
          <label className="landing-check-row"><input type="checkbox" checked={register.acceptAdult} onChange={(e) => setRegister({ ...register, acceptAdult: e.target.checked })} /> <span>Je confirme avoir 18 ans ou plus.</span></label>
          <label className="landing-check-row"><input type="checkbox" checked={register.acceptLegal} onChange={(e) => setRegister({ ...register, acceptLegal: e.target.checked, acceptCharter: e.target.checked })} /> <span>J’accepte les <a href="/mentions-legales">mentions légales</a>, <a href="/conditions-generales">CGU/CGV</a>, <a href="/confidentialite-donnees">confidentialité</a> et règles de consentement.</span></label>
          <label className="landing-check-row"><input type="checkbox" checked={register.acceptSensitiveData} onChange={(e) => setRegister({ ...register, acceptSensitiveData: e.target.checked })} /> <span>J’accepte explicitement le traitement des données sensibles nécessaires au service de rencontre libertine.</span></label>
          <div className="auth-trust-box-v121"><strong>Avant validation</strong><span>Votre profil reste modifiable après inscription. Les informations sensibles sont traitées uniquement pour le service, selon les règles légales affichées.</span></div>
          <button type="submit" className="landing-btn-primary full" disabled={busy} style={{ marginTop: 6 }}>{busy ? <><span style={{ opacity: .7 }}>Création en cours…</span></> : <>Créer mon compte — c'est gratuit</>}</button>
        </form>
      )}
    </aside>
  );

  return (
    <div className="landing-page voluptia-landing v22-landing">
      <DialogHost />
      {toast ? <div className="toast landing-toast">{toast}</div> : null}
      <main id="top" className="landing-main">

        {/* ── HERO ── */}
        <section className="lp-hero" aria-label="Accueil Voluptia">
          <div className="lp-hero-bg" aria-hidden="true" />
          <div className="lp-hero-overlay" aria-hidden="true" />
          <div className="lp-hero-inner">

            {/* Logo + Nom */}
            <div className="lp-hero-brand">
              <div className="lp-hero-brand-icon">
                <img className="lp-hero-brand-image" src="/voluptia-logo.png" alt="Logo Voluptia" />
              </div>
              <div>
                <strong>Voluptia</strong>
                <small>RENCONTRES LIBERTINES</small>
              </div>
            </div>

            {/* Séparateur */}
            <div className="lp-hero-divider">
              <span />
              <svg viewBox="0 0 24 24" fill="none" stroke="#d63f84" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.09C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z" />
              </svg>
              <span />
            </div>

            {/* Slogan */}
            <div className="lp-hero-copy">
              <p className="lp-hero-slogan">Vivez vos désirs librement</p>
              <p className="lp-hero-sub">Le réseau social libertin discret &amp; sécurisé · 18+</p>
            </div>

            {/* Boutons */}
            <div className="lp-hero-actions">
              <button type="button" className="lp-btn-primary" onClick={() => openAuth('register')}>
                Rejoindre gratuitement
              </button>
              <button type="button" className="lp-btn-ghost" onClick={() => openAuth('login')}>
                Se connecter
              </button>
            </div>

            <p className="lp-hero-reassure">Inscription gratuite · Discrétion garantie · Sans engagement</p>

          </div>
        </section>

        {/* ── AVANTAGES ── */}
        <section className="lp-features" aria-label="Avantages">
          <article className="lp-feature-card">
            <div className="lp-feature-icon">🔒</div>
            <h3>Discrétion absolue</h3>
            <p>Connexion sécurisée par HTTPS, mots de passe hachés et profils non indexés publiquement.</p>
          </article>
          <article className="lp-feature-card">
            <div className="lp-feature-icon">✦</div>
            <h3>Profils vérifiés</h3>
            <p>Inscription contrôlée, modération active, signalement en un clic.</p>
          </article>
          <article className="lp-feature-card">
            <div className="lp-feature-icon">💬</div>
            <h3>Messagerie privée</h3>
            <p>Échangez librement en privé. Albums protégés, accès sur invitation uniquement.</p>
          </article>
          <article className="lp-feature-card">
            <div className="lp-feature-icon">♡</div>
            <h3>Communauté ouverte</h3>
            <p>Célibataires, couples, trios, groupes — tous les profils sont les bienvenus.</p>
          </article>
        </section>

        <div id="contact-section" />
      </main>

      <LandingLegalFooter />

      {authOpen ? <div className="floating-auth-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAuth(); }}>{authContent}</div> : null}
    </div>
  );
}


function LandingLegalFooter() {
  return (
    <footer className="landing-legal-footer" aria-label="Documents légaux et sécurité">
      <div>
        <strong>Voluptia</strong>
        <span>Site réservé aux personnes majeures • rencontres libertines • consentement obligatoire</span>
      </div>
      <nav>
        {LEGAL_LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        <a href="#cookies" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('voluptia:open-cookie-preferences')); }}>Gérer les cookies</a>
      </nav>
    </footer>
  );
}

function LegalPublicPage({ initialSlug = 'mentions-legales' }) {
  const [slug, setSlug] = useState(initialSlug);
  useEffect(() => {
    const onPop = () => setSlug(legalSlugFromPath() || 'mentions-legales');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const page = LEGAL_PUBLIC_PAGES[slug] || LEGAL_PUBLIC_PAGES['mentions-legales'];
  return (
    <div className="landing-page legal-public-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="Retour à l’accueil">
          <span className="landing-brand-logo"><BrandLogo /></span>
          <span><strong>Voluptia</strong><small>Documents légaux</small></span>
        </a>
      </header>
      <main className="legal-public-main">
        <section className="legal-public-hero glass">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
          <nav className="legal-public-tabs" aria-label="Documents légaux">
            {LEGAL_LINKS.map((link) => (
              <a key={link.href} className={cx(slug === link.slug && 'active')} href={link.href}>{link.label}</a>
            ))}
          </nav>
        </section>
        <section className="legal-public-grid">
          {page.sections.map((section) => (
            <article className="glass panel" key={section.title}>
              <h2>{section.title}</h2>
              <ul className="legal-list">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </section>
        <article className="glass panel legal-disclaimer">
          <h2>Note importante</h2>
          <p>Ces textes sécurisent la base technique du site, mais ils contiennent encore des champs à compléter avec les informations réelles de l’éditeur, de l’hébergeur, du support et du prestataire de paiement. Avant lancement public, fais valider les documents par un professionnel du droit.</p>
        </article>
      </main>
      <LandingLegalFooter />
    </div>
  );
}

function PaywallOverlay({ plans, onOpenSubscription }) {
  return (
    <div className="paywall-overlay glass">
      <p className="eyebrow">Abonnement requis</p>
      <h2>Accès Premium requis</h2>
      <p>Découverte, messages et médias — tout s'ouvre avec un abonnement.</p>
      <div className="mini-prices">{plans.map((plan) => <span key={plan.id}>{money(plan.priceCents)} / {plan.durationDays} j</span>)}</div>
      <button type="button" className="primary-btn" onClick={onOpenSubscription}>Voir les abonnements</button>
    </div>
  );
}



function HubSubNav({ items = [], active, onChange }) {
  return (
    <nav className="hub-subnav-v65 hub-subnav-v121" role="tablist" aria-label="Sous-sections">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          className={cx(active === item.id && 'active')}
          onClick={() => onChange(item.id)}
        >
          <i><Icon name={item.icon} /></i>
          <span><strong>{item.label}</strong>{item.description ? <small>{item.description}</small> : null}</span>
          {item.badge ? <em>{item.badge}</em> : null}
        </button>
      ))}
    </nav>
  );
}

function toggleInList(list, value) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

function OptionChips({ options = [], selected = [], onToggle }) {
  const sel = Array.isArray(selected) ? selected : [];
  return (
    <div className="option-chips-v153">
      {options.map((opt) => (
        <button type="button" key={opt} className={sel.includes(opt) ? 'active' : ''} onClick={() => onToggle(opt)}>{opt}</button>
      ))}
    </div>
  );
}

function HubHeader({ eyebrow, title, description, children }) {
  // En-tête épuré : un seul titre court, sans étiquette ni carte qui alourdit.
  return (
    <header className="hub-header-v100">
      <h2 style={{ fontFamily: 'Georgia, serif', letterSpacing: '-.03em' }}>{eyebrow || title}</h2>
      {description ? <p style={{ margin: '4px 0 0', color: 'rgba(255,236,230,.55)', fontSize: '.9rem' }}>{description}</p> : null}
      {children ? <div className="hub-header-actions-v65">{children}</div> : null}
    </header>
  );
}


function ActionEmptyState({ icon = '✦', title, subtitle, primaryLabel, onPrimary, secondaryLabel, onSecondary, tips = [] }) {
  return (
    <article className="action-empty-v121">
      <div className="action-empty-icon-v121">{icon}</div>
      <div className="action-empty-copy-v121">
        <strong>{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
        {tips.length ? (
          <div className="action-empty-tips-v121">
            {tips.map((tip) => <span key={tip}>{tip}</span>)}
          </div>
        ) : null}
      </div>
      {(primaryLabel || secondaryLabel) ? (
        <div className="action-empty-actions-v121">
          {primaryLabel ? <button type="button" className="primary-btn" onClick={onPrimary}>{primaryLabel}</button> : null}
          {secondaryLabel ? <button type="button" className="secondary-btn" onClick={onSecondary}>{secondaryLabel}</button> : null}
        </div>
      ) : null}
    </article>
  );
}

function InsightStrip({ items = [] }) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="insight-strip-v121">
      {visible.map((item) => (
        <button type="button" key={item.label} className={cx('insight-pill-v121', item.tone)} onClick={item.onClick} disabled={!item.onClick}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// Leaflet est chargé depuis les dépendances npm, uniquement sur la page Lieux.
// Cela évite le CDN bloqué par la CSP et réduit le bundle initial.
let leafletPromise = null;
function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css'),
    ]).then(([module]) => module.default || module);
  }
  return leafletPromise;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function safeExternalUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

const VENUE_TYPE_ICONS = {
  'Club libertin': '🔥',
  'Sex-shop': '🛍️',
  'Glory hole': '🚪',
  'Sauna / lieu de rencontre': '♨️',
  'Bar / autre': '🍸',
};

function profileMapCoordinate(profile) {
  const loc = profile?.cityLocation || profile?.location || {};
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function cityGroupKey(profile) {
  const coords = profileMapCoordinate(profile);
  const city = normalize(profile?.cityLocation?.city || profile?.city || 'Ville non renseignée') || 'ville';
  if (!coords) return city;
  return `${city}-${coords.lat.toFixed(3)}-${coords.lng.toFixed(3)}`;
}

function buildProfileCityGroups(profiles = [], me = null) {
  const byId = new Map();
  if (me?.id) byId.set(me.id, { ...me, isMe: true });
  (profiles || []).forEach((profile) => {
    if (profile?.id && !byId.has(profile.id)) byId.set(profile.id, profile);
  });
  const grouped = new Map();
  Array.from(byId.values()).forEach((profile) => {
    const coords = profileMapCoordinate(profile);
    if (!coords) return;
    const key = cityGroupKey(profile);
    const city = profile?.cityLocation?.city || profile?.city || 'Ville non renseignée';
    if (!grouped.has(key)) grouped.set(key, { key, city, lat: coords.lat, lng: coords.lng, profiles: [], hasMe: false });
    const group = grouped.get(key);
    group.profiles.push(profile);
    if (profile.isMe) group.hasMe = true;
  });
  return Array.from(grouped.values()).sort((a, b) => (b.hasMe - a.hasMe) || b.profiles.length - a.profiles.length || a.city.localeCompare(b.city));
}

function MemberMapPage({ profiles = [], me, onOpenProfile }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const groups = useMemo(() => buildProfileCityGroups(profiles, me), [profiles, me]);
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) || null;

  useEffect(() => {
    if (!groups.length || !groups.some((group) => group.key === selectedGroupKey)) {
      setSelectedGroupKey('');
    }
  }, [groups, selectedGroupKey]);

  useEffect(() => {
    if (!groups.length) return undefined;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current) return;
      if (!mapInstanceRef.current) {
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        const map = L.map(mapRef.current, {
          scrollWheelZoom: !isMobile,
          touchZoom: true,
          tap: true,
          tapTolerance: 16,
          doubleClickZoom: true,
          dragging: true,
          zoomControl: !isMobile,
          maxBounds: [[-15, -35], [75, 55]],
          maxBoundsViscosity: 0.5,
          minZoom: 3,
          maxZoom: 18,
        });
        mapInstanceRef.current = map;
        map.fitBounds([[34.5, -10.0], [59.5, 30.0]], { animate: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(map);

        if (isMobile) {
          const ZoomBtns = L.Control.extend({
            onAdd() {
              const wrap = L.DomUtil.create('div', 'vmap-zoom-wrap-v101 member-map-zoom-v114');
              const zIn = L.DomUtil.create('button', 'vmap-ctrl-btn-v101 vmap-zoom-btn-v101', wrap);
              zIn.type = 'button';
              zIn.textContent = '+';
              const zOut = L.DomUtil.create('button', 'vmap-ctrl-btn-v101 vmap-zoom-btn-v101', wrap);
              zOut.type = 'button';
              zOut.textContent = '−';
              L.DomEvent.on(zIn, 'click', (e) => { L.DomEvent.stopPropagation(e); map.zoomIn(1); });
              L.DomEvent.on(zOut, 'click', (e) => { L.DomEvent.stopPropagation(e); map.zoomOut(1); });
              return wrap;
            },
          });
          new ZoomBtns({ position: 'topright' }).addTo(map);
        }
      }

      const map = mapInstanceRef.current;
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current = [];
      const bounds = [];
      groups.forEach((group) => {
        const count = group.profiles.length;
        const active = selectedGroup?.key === group.key;
        const icon = L.divIcon({
          className: '',
          html: `<div class="member-city-cluster-v114 ${group.hasMe ? 'mine' : ''} ${active ? 'active' : ''}"><strong>${count}</strong><span>${count > 1 ? 'profils' : 'profil'}</span></div>`,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });
        const marker = L.marker([group.lat, group.lng], { icon, keyboard: true, title: `${group.city} · ${count} profil${count > 1 ? 's' : ''}` }).addTo(map);
        marker.on('click', () => setSelectedGroupKey(group.key));
        markersRef.current.push(marker);
        bounds.push([group.lat, group.lng]);
      });
      if (bounds.length === 1) map.setView(bounds[0], 11, { animate: true });
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12, animate: true });
      else map.fitBounds([[34.5, -10.0], [59.5, 30.0]], { animate: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [groups, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup || !mapInstanceRef.current) return;
    mapInstanceRef.current.setView([selectedGroup.lat, selectedGroup.lng], Math.max(mapInstanceRef.current.getZoom(), 10), { animate: true });
  }, [selectedGroupKey]);

  if (!groups.length) {
    return <EmptyState title="Carte des membres indisponible" subtitle="Ajoute une ville à ton profil pour apparaître sur la carte. Les autres profils seront affichés par ville dès qu’ils auront une localisation approximative." />;
  }

  return (
    <section className="member-map-page-v114">
      <div className="member-map-shell-v114 glass">
        <div className="member-map-canvas-v114" ref={mapRef} aria-label="Carte des profils par ville" />
        {!selectedGroup ? <div className="member-map-hint-v114"><strong>Clique sur une bulle</strong><span>La fenêtre flottante affichera les profils de cette ville.</span></div> : null}
        {selectedGroup ? (
          <aside className="member-map-floating-v114" aria-live="polite">
            <header>
              <div>
                <p className="eyebrow">{selectedGroup.hasMe ? 'Autour de moi' : 'Ville sélectionnée'}</p>
                <h3>{selectedGroup.city}</h3>
                <small>{selectedGroup.profiles.length} profil{selectedGroup.profiles.length > 1 ? 's' : ''} dans cette ville</small>
              </div>
              <button type="button" className="member-map-close-v114" onClick={() => setSelectedGroupKey('')} aria-label="Masquer la fenêtre">×</button>
            </header>
            <div className="member-map-profile-grid-v114">
              {selectedGroup.profiles.map((profile) => (
                <button type="button" key={profile.id} className={cx('member-map-profile-card-v114', profile.isMe && 'me')} onClick={() => !profile.isMe && onOpenProfile?.(profile)}>
                  <span className="member-map-photo-v114">
                    <img src={profile.profilePhotoUrl || defaultProfilePhoto(profile.pseudo || 'Profil')} alt={profile.pseudo || 'Profil'} loading="lazy" />
                    {profile.verified ? <b title="Profil vérifié">✓</b> : null}
                  </span>
                  <strong title={profile.pseudo || 'Profil'}>{profile.isMe ? `${profile.pseudo || 'Moi'} · moi` : (profile.pseudo || 'Profil')}</strong>
                  {!profile.isMe ? <CompatibilityPill profile={profile} me={me} compact /> : null}
                  <em><i />{profile.online ? 'En ligne' : 'Profil actif'}</em>
                  <small>{profile.category || profile.type || 'Profil'}{profile.ageDisplay || memberAgeLabel(profile) ? ` · ${profile.ageDisplay || memberAgeLabel(profile)}` : ''}</small>
                </button>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function VenuesPage() {
  const [venues, setVenues] = useState([]);
  const [types, setTypes] = useState([]);
  const [activeType, setActiveType] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [mobileView, setMobileView] = useState('map');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiFetch('/venues');
        if (cancelled) return;
        setVenues(Array.isArray(result.venues) ? result.venues : []);
        setTypes(Array.isArray(result.types) ? result.types : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger les lieux.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => (activeType === 'Tous' ? venues : venues.filter((v) => v.type === activeType)),
    [venues, activeType],
  );

  // Initialise / met à jour la carte Leaflet quand les lieux filtrés changent.
  useEffect(() => {
    if (loading || error || !filtered.length) return undefined;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current) return;
      if (!mapInstanceRef.current) {
        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        const map = L.map(mapRef.current, {
          // Sur mobile : scroll roue désactivé (pinch-to-zoom natif), sur desktop activé
          scrollWheelZoom: !isMobile,
          // Pinch zoom tactile activé partout
          touchZoom: true,
          // Double-tap zoom activé sur mobile
          tap: true,
          tapTolerance: 15,
          doubleClickZoom: true,
          // Drag fluide
          dragging: true,
          inertia: true,
          inertiaDeceleration: 2800,
          inertiaMaxSpeed: 1200,
          // Zoom control masqué sur mobile (on met les nôtres)
          zoomControl: !isMobile,
          maxBounds: [[-15, -35], [75, 55]],
          maxBoundsViscosity: 0.5,
          minZoom: 3,
          maxZoom: 19,
        });
        mapInstanceRef.current = map;
        // Vue initiale : France + Europe continentale
        map.fitBounds([[34.5, -10.0], [59.5, 30.0]], { animate: false });
        // Tuiles CartoDB Dark Matter - fond sombre, sans cle API
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(map);

        // ── Contrôles custom ──────────────────────────────────────────
        // Bouton recentrer
        const ResetBtn = L.Control.extend({
          onAdd() {
            const btn = L.DomUtil.create('button', 'vmap-ctrl-btn-v101');
            btn.title = 'France & Europe';
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M3 12h18"/><path d="M12 3a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
            L.DomEvent.on(btn, 'click', (e) => {
              L.DomEvent.stopPropagation(e);
              map.fitBounds([[34.5, -10.0], [59.5, 30.0]], { animate: true, duration: 0.5 });
            });
            return btn;
          },
        });
        new ResetBtn({ position: 'topright' }).addTo(map);

        // Bouton géolocalisation
        const LocateBtn = L.Control.extend({
          onAdd() {
            const btn = L.DomUtil.create('button', 'vmap-ctrl-btn-v101 vmap-locate-btn-v101');
            btn.title = 'Ma position';
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="8"/></svg>';
            L.DomEvent.on(btn, 'click', (e) => {
              L.DomEvent.stopPropagation(e);
              btn.classList.add('loading');
              map.locate({ setView: true, maxZoom: 13, timeout: 8000, enableHighAccuracy: true });
            });
            map.on('locationfound', () => btn.classList.remove('loading'));
            map.on('locationerror', () => btn.classList.remove('loading'));
            return btn;
          },
        });
        new LocateBtn({ position: 'topright' }).addTo(map);

        // Sur mobile : boutons + / - custom (plus grands, touch-friendly)
        if (isMobile) {
          const ZoomBtns = L.Control.extend({
            onAdd() {
              const wrap = L.DomUtil.create('div', 'vmap-zoom-wrap-v101');
              const zIn = L.DomUtil.create('button', 'vmap-ctrl-btn-v101 vmap-zoom-btn-v101', wrap);
              zIn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:18px;height:18px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
              zIn.title = 'Zoom +';
              const zOut = L.DomUtil.create('button', 'vmap-ctrl-btn-v101 vmap-zoom-btn-v101', wrap);
              zOut.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:18px;height:18px"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
              zOut.title = 'Zoom -';
              L.DomEvent.on(zIn, 'click', (e) => { L.DomEvent.stopPropagation(e); map.zoomIn(1); });
              L.DomEvent.on(zOut, 'click', (e) => { L.DomEvent.stopPropagation(e); map.zoomOut(1); });
              return wrap;
            },
          });
          new ZoomBtns({ position: 'topright' }).addTo(map);
        }

        // Cercle de position après géolocalisation
        let locCircle = null;
        map.on('locationfound', (e) => {
          if (locCircle) map.removeLayer(locCircle);
          locCircle = L.circle(e.latlng, {
            radius: Math.min(e.accuracy / 2, 500),
            color: '#ff8fc5',
            fillColor: '#ff8fc5',
            fillOpacity: 0.12,
            weight: 2,
          }).addTo(map);
          L.circleMarker(e.latlng, {
            radius: 7,
            color: '#fff',
            fillColor: '#ff8fc5',
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
        });
      }
      const map = mapInstanceRef.current;
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];
      const bounds = [];
      filtered.forEach((venue) => {
        if (!venue.located) return;
        const venueColor = { 'Club libertin':'#D4537E','Sex-shop':'#8f5fd9','Glory hole':'#E87A3D','Sauna / lieu de rencontre':'#3DBBE8','Bar / autre':'#639922' }[venue.type] || '#ff8fc5';
        const icon = L.divIcon({
          className: '',
          html: '<div class="vmap-pin-v100" style="--pin-color:' + venueColor + '">' + (VENUE_TYPE_ICONS[venue.type] || '!') + '</div>',
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          popupAnchor: [0, -46],
        });
        const marker = L.marker([venue.lat, venue.lng], { icon }).addTo(map);
        const safeWebsite = safeExternalUrl(venue.website);
        const ph = '<div class="vmap-popup-v100"><strong>'
          + escapeHtml(venue.name)
          + '</strong><span>'
          + escapeHtml(venue.type)
          + (venue.city ? ' - ' + escapeHtml(venue.city) : '')
          + '</span>'
          + (venue.address ? '<small>' + escapeHtml(venue.address) + '</small>' : '')
          + (safeWebsite ? '<a href="' + escapeHtml(safeWebsite) + '" target="_blank" rel="noopener noreferrer">Site web</a>' : '')
          + '</div>';
        marker.bindPopup(ph, { className: 'vmap-popup-wrapper-v100' });
        marker.on('click', () => {
          setSelected(venue.id);
          // Sur mobile, pan vers le haut pour éviter que la popup soit cachée par le panneau liste
          if (window.matchMedia('(max-width: 600px)').matches) {
            setTimeout(() => map.panBy([0, -80], { animate: true }), 80);
          }
        });
        markersRef.current.push(marker);
        bounds.push([venue.lat, venue.lng]);
      });
      if (bounds.length === 1) map.setView(bounds[0], 13, { animate: true });
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: true });
      else map.fitBounds([[34.5, -10.0], [59.5, 30.0]], { animate: true });
    }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [filtered, loading, error]);

  function focusVenue(venue) {
    setSelected(venue.id);
    setMobileView('map');
    if (mapInstanceRef.current && venue.located) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.setView([venue.lat, venue.lng], 15, { animate: true });
        }
      }, 50);
    }
  }

  useEffect(() => {
    if (mobileView === 'map' && mapInstanceRef.current) {
      setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 30);
    }
  }, [mobileView]);

  return (
    <section className="venues-page-v96">
      <div className="venues-filters-v96">
        <button type="button" className={cx('venue-chip-v96', activeType === 'Tous' && 'active')} onClick={() => setActiveType('Tous')}>Tous</button>
        {types.map((type) => (
          <button type="button" key={type} className={cx('venue-chip-v96', activeType === type && 'active')} onClick={() => setActiveType(type)}>
            {VENUE_TYPE_ICONS[type] || '📍'} {type}
          </button>
        ))}
      </div>

      {loading ? <EmptyState title="Chargement de la carte…" /> : null}
      {error ? <EmptyState title={error} /> : null}
      {!loading && !error && !venues.length ? (
        <ActionEmptyState
          icon="📍"
          title="Aucun lieu pour le moment."
          subtitle="Les clubs, saunas, bars et adresses partenaires apparaîtront ici dès qu’ils seront ajoutés depuis l’administration."
          tips={["Astuce admin : ajoutez 5 à 10 lieux de départ pour donner vie à la carte."]}
        />
      ) : null}

      {!loading && !error && venues.length ? (
        <div className="venues-layout-v96">
          <div style={{ position: 'relative' }}>
            <div className="venues-map-v96" ref={mapRef} aria-label="Carte des lieux France et Europe"
              style={{ display: mobileView === 'list' ? 'none' : undefined }}
            />
            <div className="venues-view-toggle-v96" style={{ display: 'none' }}>
              <button type="button" className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}>Carte</button>
              <button type="button" className={mobileView === 'list' ? 'active' : ''} onClick={() => setMobileView('list')}>Liste</button>
            </div>
          </div>
          <div className="venues-list-v96">
            {filtered.map((venue) => (
              <button type="button" key={venue.id} className={cx('venue-card-v96 glass', selected === venue.id && 'active')} onClick={() => focusVenue(venue)}>
                <span className="venue-icon-v96" style={{ color: { 'Club libertin':'#D4537E','Sex-shop':'#8f5fd9','Glory hole':'#E87A3D','Sauna / lieu de rencontre':'#3DBBE8','Bar / autre':'#639922' }[venue.type] || '#ff8fc5' }}>{VENUE_TYPE_ICONS[venue.type] || '!'}</span>
                <span className="venue-info-v96">
                  <strong>{venue.name}</strong>
                  <small>{venue.type}{venue.city ? ` · ${venue.city}` : ''}</small>
                  <small className="venue-address-v96">{venue.address}</small>
                  {venue.phone ? <small>☎ {venue.phone}</small> : null}
                  {venue.website ? <a href={venue.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Site web ↗</a> : null}
                </span>
                {venue.mapUrl ? <a className="venue-itinerary-v96" href={venue.mapUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Itinéraire</a> : null}
              </button>
            ))}
            {!filtered.length ? <ActionEmptyState icon="📍" title="Aucun lieu de ce type." subtitle="Essayez un autre filtre ou ajoutez des adresses dans l’administration." /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ----- Événements (pages créées par les membres, façon agenda club) -----
const EVENT_AUDIENCE_OPTIONS = [
  { id: 'all', label: 'Ouvert à tous' },
  { id: 'couples_women', label: 'Couples et femmes' },
  { id: 'couples', label: 'Couples uniquement' },
  { id: 'women', label: 'Femmes uniquement' },
];

function formatEventPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${num.toFixed(2).replace('.', ',')} €`;
}

function formatEventRange(startAt, endAt) {
  if (!startAt) return '';
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : start;
  const dateFmt = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const timeFmt = { hour: '2-digit', minute: '2-digit' };
  const sameDay = start.toDateString() === end.toDateString();
  try {
    if (sameDay) {
      return `${start.toLocaleDateString('fr-FR', dateFmt)} · ${start.toLocaleTimeString('fr-FR', timeFmt)} – ${end.toLocaleTimeString('fr-FR', timeFmt)}`;
    }
    return `Du ${start.toLocaleDateString('fr-FR', dateFmt)} (${start.toLocaleTimeString('fr-FR', timeFmt)}) au ${end.toLocaleDateString('fr-FR', dateFmt)} (${end.toLocaleTimeString('fr-FR', timeFmt)})`;
  } catch { return startAt; }
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventImage({ url, alt = '', className, fallback = null }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true; let objectUrl = '';
    if (!url) { setSrc(''); return undefined; }
    apiFetchBlobUrl(url).then((u) => { if (active) { objectUrl = u; setSrc(u); } }).catch(() => { if (active) setSrc(''); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (!url) return fallback;
  if (!src) return <div className={cx('event-img-skeleton', className)} aria-hidden="true" />;
  return <img className={className} src={src} alt={alt} loading="lazy" />;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: String(reader.result || ''), mimeType: file.type || 'image/jpeg' });
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

function EventForm({ initial, onCancel, onSaved, showToast }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    startAt: toDatetimeLocalValue(initial?.startAt) || '',
    endAt: toDatetimeLocalValue(initial?.endAt) || '',
    address: initial?.location?.address || '',
    locationLabel: initial?.location?.label || '',
    priceCouple: initial?.priceCouple ?? '',
    priceWoman: initial?.priceWoman ?? '',
    audience: initial?.audience || 'all',
  });
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function pickBanner(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setBanner(await fileToDataUrl(file)); } catch (e) { showToast?.(e.message || 'Image invalide.'); }
  }

  async function submit() {
    if (!form.title.trim()) { showToast?.('Le titre est obligatoire.'); return; }
    if (!form.startAt) { showToast?.('La date de début est obligatoire.'); return; }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : new Date(form.startAt).toISOString(),
        address: form.address.trim(),
        locationLabel: form.locationLabel.trim(),
        priceCouple: form.priceCouple === '' ? null : Number(form.priceCouple),
        priceWoman: form.priceWoman === '' ? null : Number(form.priceWoman),
        audience: form.audience,
      };
      if (banner) payload.banner = banner;
      const result = editing
        ? await apiFetch(`/events/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch('/events', { method: 'POST', body: JSON.stringify(payload) });
      showToast?.(result.message || (editing ? 'Événement mis à jour.' : 'Événement créé.'));
      onSaved?.(result.event);
    } catch (error) {
      showToast?.(error.message || 'Enregistrement impossible.');
    } finally { setBusy(false); }
  }

  return (
    <div className="event-form-v2 form-grid one">
      <h2>{editing ? 'Modifier l’événement' : 'Créer un événement'}</h2>
      <Field label="Titre" value={form.title} onChange={(v) => set('title', v)} placeholder="Ex : Beyond Desire – La Nuit Céleste" />
      <label className="field"><span>Description</span><textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Programme, ambiance, dress code…" rows={4} /></label>
      <div className="event-form-row-v2">
        <Field label="Début" type="datetime-local" value={form.startAt} onChange={(v) => set('startAt', v)} />
        <Field label="Fin (peut durer plusieurs jours)" type="datetime-local" value={form.endAt} onChange={(v) => set('endAt', v)} />
      </div>
      <Field label="Adresse (pour la carte)" value={form.address} onChange={(v) => set('address', v)} placeholder="Le Cap d’Agde, Agde, Hérault, France" />
      <Field label="Nom du lieu (optionnel)" value={form.locationLabel} onChange={(v) => set('locationLabel', v)} placeholder="Le Jardin Babylone" />
      <div className="event-form-row-v2">
        <Field label="Prix couples (€)" type="number" value={form.priceCouple} onChange={(v) => set('priceCouple', v)} placeholder="40" />
        <Field label="Prix femmes (€)" type="number" value={form.priceWoman} onChange={(v) => set('priceWoman', v)} placeholder="20" />
      </div>
      <label className="field"><span>Accès</span>
        <select value={form.audience} onChange={(e) => set('audience', e.target.value)}>
          {EVENT_AUDIENCE_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      </label>
      <label className="field"><span>Bannière / affiche</span><input type="file" accept="image/*" onChange={pickBanner} /></label>
      {banner ? <img className="event-banner-preview-v2" src={banner.dataUrl} alt="Aperçu bannière" /> : null}
      <div className="event-form-actions-v2">
        <button type="button" className="ghost-btn" onClick={onCancel} disabled={busy}>Annuler</button>
        <button type="button" className="primary-btn" onClick={submit} disabled={busy}>{busy ? 'Enregistrement…' : (editing ? 'Enregistrer' : 'Publier l’événement')}</button>
      </div>
      <p className="hint">L’événement est supprimé automatiquement 24 h après sa date de fin. Les tarifs sont affichés à titre informatif (pas de paiement en ligne).</p>
    </div>
  );
}

function EventDetail({ eventId, me, showToast, onBack, onChanged, onOpenProfile }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const photoInput = useRef(null);

  async function load() {
    try { const result = await apiFetch(`/events/${eventId}`); setEvent(result.event); }
    catch (e) { setError(e.message || 'Événement introuvable.'); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  async function toggleParticipate() {
    setBusy(true);
    try { const r = await apiFetch(`/events/${eventId}/participate`, { method: 'POST' }); setEvent(r.event); showToast?.(r.message); onChanged?.(); }
    catch (e) { showToast?.(e.message || 'Action impossible.'); } finally { setBusy(false); }
  }
  async function addPhotos(ev) {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const photos = [];
      for (const file of files.slice(0, 20)) photos.push(await fileToDataUrl(file));
      const r = await apiFetch(`/events/${eventId}/photos`, { method: 'POST', body: JSON.stringify({ photos }) });
      setEvent(r.event); showToast?.(r.message);
    } catch (e) { showToast?.(e.message || 'Ajout impossible.'); } finally { setBusy(false); if (photoInput.current) photoInput.current.value = ''; }
  }
  async function removePhoto(fileId) {
    setBusy(true);
    try { const r = await apiFetch(`/events/${eventId}/photos/${fileId}`, { method: 'DELETE' }); setEvent(r.event); showToast?.(r.message); }
    catch (e) { showToast?.(e.message || 'Suppression impossible.'); } finally { setBusy(false); }
  }
  async function removeEvent() {
    if (!window.confirm('Supprimer définitivement cet événement ?')) return;
    setBusy(true);
    try { await apiFetch(`/events/${eventId}`, { method: 'DELETE' }); showToast?.('Événement supprimé.'); onChanged?.(); onBack?.(); }
    catch (e) { showToast?.(e.message || 'Suppression impossible.'); } finally { setBusy(false); }
  }

  if (error) return <div className="event-detail-v2"><button type="button" className="ghost-btn" onClick={onBack}>← Retour</button><EmptyState title={error} /></div>;
  if (!event) return <div className="event-detail-v2"><button type="button" className="ghost-btn" onClick={onBack}>← Retour</button><div className="event-img-skeleton" style={{ height: 180 }} /></div>;
  if (editing) return <div className="event-detail-v2"><EventForm initial={event} showToast={showToast} onCancel={() => setEditing(false)} onSaved={(updated) => { setEvent(updated); setEditing(false); onChanged?.(); }} /></div>;

  const mapsHref = (event.location?.lat != null && event.location?.lng != null)
    ? `https://www.openstreetmap.org/?mlat=${event.location.lat}&mlon=${event.location.lng}#map=15/${event.location.lat}/${event.location.lng}`
    : (event.location?.address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location.address)}` : '');

  return (
    <div className="event-detail-v2">
      <button type="button" className="ghost-btn event-back-v2" onClick={onBack}>← Tous les événements</button>
      <div className="event-hero-v2">
        <EventImage url={event.bannerUrl} alt={event.title} className="event-hero-img-v2" fallback={<div className="event-hero-fallback-v2"><Icon name="overview" /></div>} />
        {event.audienceLabel ? <span className="event-audience-pill-v2">{event.audienceLabel}</span> : null}
      </div>
      <h2 className="event-title-v2">{event.title}</h2>
      <button type="button" className="event-organizer-v2" onClick={() => event.organizer?.id && onOpenProfile?.(event.organizer.id)}>
        <Avatar profile={event.organizer} /> <span>Organisé par <strong>{event.organizer?.pseudo || event.organizer?.name || 'Membre'}</strong> · {event.visibility === 'private' ? 'PRIVÉ' : 'PUBLIC'}</span>
      </button>

      <div className="event-info-card-v2">
        <p className="event-info-line-v2"><Icon name="overview" /> {formatEventRange(event.startAt, event.endAt)}</p>
        {event.location?.address || event.location?.label ? (
          <p className="event-info-line-v2"><Icon name="places" /> <span><strong>{event.location.label || event.location.city || 'Lieu'}</strong>{event.location.address ? <><br />{event.location.address}</> : null}{mapsHref ? <> · <a href={mapsHref} target="_blank" rel="noreferrer">Voir la carte</a></> : null}</span></p>
        ) : null}
      </div>

      <div className="event-stats-v2"><Stat value={event.visits} label="Visites" /><Stat value={event.participantCount} label="Participants" /></div>

      {(event.priceCouple != null || event.priceWoman != null) ? (
        <div className="event-prices-v2">
          {event.priceCouple != null ? <div><strong>{formatEventPrice(event.priceCouple)}</strong><span>Couples</span></div> : null}
          {event.priceWoman != null ? <div><strong>{formatEventPrice(event.priceWoman)}</strong><span>Femmes</span></div> : null}
        </div>
      ) : null}
      {event.audienceLabel ? <p className="event-restriction-v2">{event.audienceLabel}</p> : null}

      {event.description ? <p className="event-description-v2">{event.description}</p> : null}

      {!event.isOwner ? (
        <button type="button" className={cx('event-participate-v2', event.isParticipant && 'is-on')} onClick={toggleParticipate} disabled={busy}>
          {event.isParticipant ? '✓ Je participe (annuler)' : 'Je participe'}
        </button>
      ) : null}

      <div className="event-gallery-head-v2">
        <h3>Photos {event.photos?.length ? `(${event.photos.length})` : ''}</h3>
        {event.isOwner ? <><input ref={photoInput} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={addPhotos} /><button type="button" className="small-btn" onClick={() => photoInput.current?.click()} disabled={busy}>+ Ajouter</button></> : null}
      </div>
      {event.photos?.length ? (
        <div className="event-gallery-v2">
          {event.photos.map((photo) => (
            <div className="event-gallery-item-v2" key={photo.fileId}>
              <EventImage url={photo.url} alt="Photo de l’événement" className="event-gallery-img-v2" />
              {event.isOwner ? <button type="button" className="event-photo-del-v2" onClick={() => removePhoto(photo.fileId)} aria-label="Supprimer la photo">×</button> : null}
            </div>
          ))}
        </div>
      ) : <EmptyState title="Aucune photo pour l’instant." subtitle={event.isOwner ? 'Ajoutez les photos de votre événement.' : ''} />}

      {event.isOwner ? (
        <div className="event-owner-actions-v2">
          <button type="button" className="ghost-btn" onClick={() => setEditing(true)} disabled={busy}>Modifier</button>
          <button type="button" className="danger-btn" onClick={removeEvent} disabled={busy}>Supprimer</button>
        </div>
      ) : null}
    </div>
  );
}

function EventCard({ event, onOpen }) {
  return (
    <button type="button" className="event-card-v2" onClick={() => onOpen(event.id)}>
      <div className="event-card-banner-v2">
        <EventImage url={event.bannerUrl} alt={event.title} className="event-card-img-v2" fallback={<div className="event-hero-fallback-v2"><Icon name="overview" /></div>} />
        {event.audienceLabel ? <span className="event-card-pill-v2">{event.audienceLabel}</span> : null}
      </div>
      <div className="event-card-body-v2">
        <strong className="event-card-title-v2">{event.title}</strong>
        <span className="event-card-meta-v2"><Icon name="overview" /> {formatEventRange(event.startAt, event.endAt)}</span>
        {event.location?.label || event.location?.city ? <span className="event-card-meta-v2"><Icon name="places" /> {event.location.label || event.location.city}</span> : null}
        <span className="event-card-stats-v2">{event.participantCount} participant·e·s · {event.visits} visites</span>
      </div>
    </button>
  );
}

function EventsPage({ me, showToast, onOpenProfile }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [selectedId, setSelectedId] = useState('');

  async function load() {
    setLoading(true);
    try { const result = await apiFetch('/events'); setEvents(Array.isArray(result.events) ? result.events : []); }
    catch (e) { showToast?.(e.message || 'Chargement impossible.'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (view === 'detail' && selectedId) {
    return <EventDetail eventId={selectedId} me={me} showToast={showToast} onOpenProfile={onOpenProfile} onBack={() => { setView('list'); load(); }} onChanged={load} />;
  }
  if (view === 'create') {
    return <div className="events-page-v2"><EventForm showToast={showToast} onCancel={() => setView('list')} onSaved={(created) => { setView('detail'); setSelectedId(created.id); load(); }} /></div>;
  }
  return (
    <div className="events-page-v2">
      <div className="events-head-v2">
        <div><h2>Événements</h2><p className="hint">Soirées, clubs et rencontres organisées par la communauté.</p></div>
        <button type="button" className="primary-btn" onClick={() => setView('create')}>+ Créer un événement</button>
      </div>
      {loading ? <div className="event-img-skeleton" style={{ height: 140 }} />
        : events.length ? <div className="events-grid-v2">{events.map((event) => <EventCard key={event.id} event={event} onOpen={(id) => { setSelectedId(id); setView('detail'); }} />)}</div>
        : <EmptyState title="Aucun événement à venir." subtitle="Soyez le premier à en créer un." icon="✦" />}
    </div>
  );
}

function DiscoverHub({ activeSubTab = 'Carte', onSubTabChange, profiles, profileMap = [], me, social = {}, grantedByMe = [], options, conversations = [], subscription, videos = [], onView, onShare, onRefresh, onFollow, onHeart, onPass, onMessage, onOpenProfile, onOpenPrivateAlbum, onExchangePrivateAlbums, onBlock, onUnblock, onRequestAlbum, onReport, onLike, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, onNavigate, showToast }) {
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const mapProfiles = Array.isArray(profileMap) && profileMap.length ? profileMap : safeProfiles;
  const mappedCities = buildProfileCityGroups(mapProfiles, me).length;
  const items = [
    { id: 'Carte', icon: 'places', label: 'Carte', description: 'Profils par ville', badge: mappedCities ? `${mappedCities}` : '' },
    { id: 'Recherche', icon: 'search', label: 'Recherche', description: 'Filtres détaillés', badge: `${safeProfiles.length}` },
    { id: 'Lieux', icon: 'places', label: 'Lieux', description: 'Clubs & adresses', badge: '' },
    { id: 'Événements', icon: 'overview', label: 'Événements', description: 'Soirées & clubs', badge: '' },
  ];
  const active = items.some((item) => item.id === activeSubTab) ? activeSubTab : 'Carte';
  return (
    <section className={cx('page hub-page-v65 discover-hub-v65 discover-hub-v175-no-hero', active === 'Carte' && 'discover-map-full-v176')}>
      <HubSubNav items={items} active={active} onChange={onSubTabChange} />
      <div className="hub-content-v65">
        {active === 'Carte' ? <MemberMapPage profiles={mapProfiles} me={me} onOpenProfile={onOpenProfile} /> : null}
        {active === 'Recherche' ? <SearchPage profiles={profiles} me={me} social={social} grantedByMe={grantedByMe} options={options} videos={videos} onView={onView} onShare={onShare} onRefresh={onRefresh} onLike={onLike} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} showToast={showToast} onFollow={onFollow} onHeart={onHeart} onPass={onPass} onMessage={onMessage} onOpenProfile={onOpenProfile} onOpenPrivateAlbum={onOpenPrivateAlbum} onExchangePrivateAlbums={onExchangePrivateAlbums} onRequestAlbum={onRequestAlbum} onReport={onReport} /> : null}
        {active === 'Lieux' ? <VenuesPage /> : null}
        {active === 'Événements' ? <EventsPage me={me} showToast={showToast} onOpenProfile={onOpenProfile} /> : null}
      </div>
    </section>
  );
}

function MediaHub({ activeSubTab = 'Toktak', onSubTabChange, videos = [], profiles, me, onLike, onView, onShare, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, onOpenProfile, onRefresh, showToast, onRequestAlbum }) {
  const safeVideos = Array.isArray(videos) ? videos : [];
  const publicAlbums = (Array.isArray(profiles) ? profiles : []).reduce((sum, profile) => sum + (profile.albums || []).filter((album) => album.visibility !== 'private').length, 0);
  const items = [
    { id: 'Toktak', icon: 'video', label: 'Toktak', badge: `${safeVideos.length}` },
    { id: 'Albums', icon: 'albums', label: 'Albums', badge: `${publicAlbums}` },
  ];
  const active = items.some((item) => item.id === activeSubTab) ? activeSubTab : 'Toktak';
  return (
    <section className="page hub-page-v65 media-hub-v65 media-hub-clean-v124 media-fullscreen-v186">
      <div className="hub-content-v65 media-content-v65">
        <ToktakFeed videos={videos} me={me} onLike={onLike} onView={onView} onShare={onShare} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} onOpenProfile={onOpenProfile} onRefresh={onRefresh} showToast={showToast} />
      </div>
    </section>
  );
}

function GroupChat({ group, me, showToast, onBack, onUpdated, onLeft }) {
  const [conv, setConv] = useState(group);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef(null);

  async function load() {
    setLoading(true);
    try { const r = await apiFetch(`/group-conversations/${group.id}/messages`); setMessages(r.messages || []); setConv(r.conversation); }
    catch (e) { showToast?.(e.message || 'Groupe indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [group.id]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const nameFor = (fromId) => {
    if (fromId === me?.id) return 'Vous';
    const m = (conv.members || []).find((x) => x.id === fromId);
    return m?.pseudo || 'Membre';
  };

  async function send(e) {
    e.preventDefault();
    const body = draft.trim().slice(0, 1200);
    if (!body) return;
    setDraft('');
    try { const r = await apiFetch(`/group-conversations/${group.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }); setMessages((cur) => [...cur, r.message]); setConv(r.conversation); onUpdated?.(r.conversation); }
    catch (err) { setDraft(body); showToast?.(err.message || 'Envoi impossible.'); }
  }
  async function removeMember(id) {
    try { const r = await apiFetch(`/group-conversations/${group.id}/members/${id}`, { method: 'DELETE' }); setConv(r.conversation); onUpdated?.(r.conversation); showToast?.(r.message); }
    catch (e) { showToast?.(e.message || 'Action impossible.'); }
  }
  async function leave() {
    if (!window.confirm('Quitter ce groupe ?')) return;
    try { await apiFetch(`/group-conversations/${group.id}/leave`, { method: 'POST' }); showToast?.('Vous avez quitté le groupe.'); onLeft?.(group.id); }
    catch (e) { showToast?.(e.message || 'Action impossible.'); }
  }

  return (
    <div className="group-chat-v2">
      <div className="group-chat-head-v2">
        <button type="button" className="ghost-btn" onClick={onBack}>←</button>
        <button type="button" className="group-chat-title-v2" onClick={() => setShowMembers((v) => !v)}>
          <strong>{conv.name || 'Groupe'}</strong>
          <small>{(conv.members || []).length} membres · voir</small>
        </button>
      </div>
      {showMembers ? (
        <div className="group-members-v2">
          {(conv.members || []).map((member) => (
            <div className="group-member-row-v2" key={member.id}>
              <Avatar profile={member} /><span>{member.pseudo}{member.id === conv.ownerId ? ' · créateur' : ''}</span>
              {conv.isOwner && member.id !== me?.id ? <button type="button" className="group-member-del-v2" onClick={() => removeMember(member.id)}>Retirer</button> : null}
            </div>
          ))}
          <div className="group-members-actions-v2">
            {conv.isOwner && (conv.members || []).length < 5 ? <button type="button" className="small-btn" onClick={() => setAdding(true)}>+ Ajouter un membre</button> : null}
            <button type="button" className="danger-btn" onClick={leave}>Quitter le groupe</button>
          </div>
        </div>
      ) : null}
      {adding ? <GroupMemberPicker excludeIds={(conv.members || []).map((m) => m.id)} title="Ajouter au groupe" confirmLabel="Ajouter" max={5 - (conv.members || []).length} single onCancel={() => setAdding(false)} onConfirm={async (ids) => { setAdding(false); for (const id of ids) { try { const r = await apiFetch(`/group-conversations/${group.id}/members`, { method: 'POST', body: JSON.stringify({ profileId: id }) }); setConv(r.conversation); onUpdated?.(r.conversation); } catch (e) { showToast?.(e.message || 'Ajout impossible.'); } } }} /> : null}
      <div className="group-messages-v2" ref={scrollRef}>
        {loading ? <div className="event-img-skeleton" style={{ height: 60 }} />
          : messages.length ? messages.map((m) => (
            <div className={cx('group-msg-v2', m.fromId === me?.id && 'mine')} key={m.id}>
              {m.fromId !== me?.id ? <span className="group-msg-author-v2">{nameFor(m.fromId)}</span> : null}
              <p>{m.body}</p>
            </div>
          )) : <EmptyState title="Aucun message." subtitle="Lancez la discussion du groupe." />}
      </div>
      <form className="group-composer-v2" onSubmit={send}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Votre message au groupe…" maxLength={1200} />
        <button type="submit" className="primary-btn" disabled={!draft.trim()}>Envoyer</button>
      </form>
    </div>
  );
}

function GroupMemberPicker({ excludeIds = [], title = 'Nouveau groupe', confirmLabel = 'Créer', max = 4, single = false, showName = false, onCancel, onConfirm }) {
  const [profiles, setProfiles] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/profiles').then((r) => { if (!cancelled) setProfiles(Array.isArray(r.profiles) ? r.profiles : []); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const candidates = profiles
    .filter((p) => p?.id && !excludeIds.includes(p.id))
    .filter((p) => { const q = String(query || '').trim().toLowerCase(); return !q || String(p.pseudo || '').toLowerCase().includes(q) || String(p.city || '').toLowerCase().includes(q); })
    .slice(0, 40);
  function toggle(id) {
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : (cur.length >= max ? cur : [...cur, id]));
  }
  return (
    <div className="group-picker-backdrop-v2" onClick={onCancel}>
      <div className="group-picker-v2" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {showName ? <input className="group-picker-name-v2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe (optionnel)" maxLength={80} /> : null}
        <input className="group-picker-search-v2" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un membre…" />
        <p className="hint">{selected.length}/{max} sélectionné·e·s</p>
        <div className="group-picker-list-v2">
          {loading ? <div className="event-img-skeleton" style={{ height: 50 }} />
            : candidates.length ? candidates.map((p) => (
              <button type="button" key={p.id} className={cx('group-picker-item-v2', selected.includes(p.id) && 'on')} onClick={() => toggle(p.id)}>
                <Avatar profile={p} /><span><strong>{p.pseudo || 'Membre'}</strong><small>{p.city || ''}</small></span>
                <i className="group-picker-check-v2">{selected.includes(p.id) ? '✓' : ''}</i>
              </button>
            )) : <EmptyState title="Aucun membre trouvé." />}
        </div>
        <div className="group-picker-actions-v2">
          <button type="button" className="ghost-btn" onClick={onCancel}>Annuler</button>
          <button type="button" className="primary-btn" disabled={!selected.length} onClick={() => onConfirm(selected, name)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function GroupsPanel({ groups = [], me, showToast, canReply = true }) {
  const [list, setList] = useState(groups);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState('');
  useEffect(() => { setList(groups); }, [groups]);

  const openGroup = list.find((g) => g.id === openId);
  if (openGroup) {
    return <GroupChat group={openGroup} me={me} showToast={showToast} onBack={() => setOpenId('')}
      onUpdated={(updated) => setList((cur) => cur.map((g) => g.id === updated.id ? updated : g))}
      onLeft={(id) => { setList((cur) => cur.filter((g) => g.id !== id)); setOpenId(''); }} />;
  }
  return (
    <div className="groups-panel-v2">
      <div className="groups-head-v2">
        <div><h3>Groupes</h3><span className="hint">Discussions à plusieurs (5 personnes max).</span></div>
        <button type="button" className="primary-btn" onClick={() => setCreating(true)}>+ Nouveau groupe</button>
      </div>
      {list.length ? (
        <div className="groups-list-v2">
          {list.map((g) => (
            <button type="button" className="group-card-v2" key={g.id} onClick={() => setOpenId(g.id)}>
              <div className="group-card-avatars-v2">{(g.members || []).slice(0, 3).map((m) => <Avatar key={m.id} profile={m} />)}</div>
              <span className="group-card-info-v2">
                <strong>{g.name || 'Groupe'}</strong>
                <small>{(g.members || []).map((m) => m.id === me?.id ? 'Vous' : m.pseudo).join(', ')}</small>
                {g.lastMessage?.body ? <em>{g.lastMessage.body}</em> : null}
              </span>
              {Number(g.unread || 0) > 0 ? <b className="group-card-badge-v2">{g.unread}</b> : null}
            </button>
          ))}
        </div>
      ) : <p className="groups-empty-v2 hint">Aucun groupe. Créez-en un pour discuter à plusieurs.</p>}
      {creating ? (
        <GroupMemberPicker title="Nouveau groupe" confirmLabel="Créer le groupe" max={4} showName
          onCancel={() => setCreating(false)}
          onConfirm={async (ids, name) => {
            try {
              const r = await apiFetch('/group-conversations', { method: 'POST', body: JSON.stringify({ name, participantIds: ids }) });
              setList((cur) => [r.conversation, ...cur]); setCreating(false); setOpenId(r.conversation.id); showToast?.('Groupe créé.');
            } catch (e) { showToast?.(e.message || 'Création impossible.'); }
          }} />
      ) : null}
    </div>
  );
}

function MessagesHub({ activeSubTab = 'Messages', canReply = true, onSubTabChange, conversations = [], profiles = [], me, showToast, activeProfileId, onConversationOpened, notifications = [], onReadAll, onOpenProfile, onReport, onNavigate, social = {}, onFollow, onMessage, onBlock }) {
  const unreadMessages = conversations.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0);
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const items = [
    { id: 'Messages', icon: 'messages', label: 'Conversations', description: 'Chat privé', badge: unreadMessages ? `${unreadMessages}` : '' },
    { id: 'Notifications', icon: 'alerts', label: 'Alertes', description: 'Likes, accès, système', badge: unreadNotifications ? `${unreadNotifications}` : '' },
    { id: 'Interactions', icon: 'heart', label: 'Interactions', description: 'Likes, matchs, albums', badge: social?.counters ? String((social.counters.mediaReactionsReceived || 0) + (social.counters.commentsReceived || 0) + (social.matches?.length || 0)) : '' },
  ];
  const active = items.some((item) => item.id === activeSubTab) ? activeSubTab : 'Messages';
  return (
    <section className="page hub-page-v65 messages-hub-v65 messages-hub-clean-v171">
      <HubSubNav items={items} active={active} onChange={onSubTabChange} />
      <div className="hub-content-v65">
        {active === 'Messages' ? <><GroupsPanel groups={conversations.filter((c) => c.isGroup)} me={me} showToast={showToast} canReply={canReply} /><Messages conversations={conversations.filter((c) => !c.isGroup)} profiles={profiles} me={me} showToast={showToast} activeProfileId={activeProfileId} onConversationOpened={onConversationOpened} onOpenProfile={onOpenProfile} onReport={onReport} onNavigate={onNavigate} canReply={canReply} /></> : null}
        {active === 'Notifications' ? <Notifications notifications={notifications} onReadAll={onReadAll} onNavigate={onNavigate} /> : null}
        {active === 'Interactions' ? <SocialInteractionsPage social={social} onOpenProfile={onOpenProfile} onMessage={onMessage} onFollow={onFollow} onBlock={onBlock} onReport={onReport} onNavigate={onNavigate} /> : null}
      </div>
    </section>
  );
}


function SocialInteractionsPage({ social = {}, onOpenProfile, onMessage, onFollow, onBlock, onReport, onNavigate }) {
  const [tab, setTab] = useState('Tout');
  const sections = [
    ['Tout', (social.mediaReactionsReceived || []).length + (social.commentsReceived || []).length + (social.matches || []).length],
    ['Likes reçus', (social.incomingLikes || []).length],
    ['Réactions médias', (social.mediaReactionsReceived || []).length],
    ['Commentaires', (social.commentsReceived || []).length],
    ['Visites profil', (social.recentViews || []).length],
    ['Coups de cœur', (social.outgoingLikes || []).length],
    ['Matchs', (social.matches || []).length],
    ['Suivis', (social.followers || []).length],
    ['Albums privés', (social.privateAlbumGrants || []).length],
    ['Demandes en attente', (social.pendingAlbumRequests || []).length],
  ];
  function itemsFor(active) {
    const rows = [];
    const add = (type, arr = [], mapper = (item) => item) => arr.forEach((item) => rows.push({ type, ...mapper(item) }));
    if (active === 'Tout' || active === 'Likes reçus') add('Like reçu', social.incomingLikes, (item) => ({ profile: item.profile, date: item.createdAt, detail: 'vous a envoyé un coup de cœur' }));
    if (active === 'Tout' || active === 'Réactions médias') add('Réaction média', social.mediaReactionsReceived, (item) => ({ profile: item.profile, date: item.createdAt, detail: `${item.reactionLabel || 'a réagi'} sur ${item.media?.title || 'un média'}`, media: item.media }));
    if (active === 'Tout' || active === 'Commentaires') add('Commentaire', social.commentsReceived, (item) => ({ profile: item.profile, date: item.createdAt, detail: item.body || 'a commenté votre média', media: item.media }));
    if (active === 'Tout' || active === 'Visites profil') add('Visite profil', social.recentViews, (item) => ({ profile: item.profile, date: item.lastViewedAt || item.createdAt, detail: 'a visité votre profil' }));
    if (active === 'Tout' || active === 'Coups de cœur') add('Coup de cœur', social.outgoingLikes, (item) => ({ profile: item.profile, date: item.createdAt, detail: 'coup de cœur envoyé' }));
    if (active === 'Tout' || active === 'Matchs') add('Match', social.matches, (item) => ({ profile: item.profile, date: item.matchedAt || item.createdAt, detail: 'match réciproque' }));
    if (active === 'Tout' || active === 'Suivis') add('Suivi', social.followers, (item) => ({ profile: item.profile, date: item.createdAt, detail: 'vous suit' }));
    if (active === 'Tout' || active === 'Albums privés') add('Album privé', social.privateAlbumGrants, (item) => ({ profile: item.viewer || item.owner, date: item.grantedAt || item.createdAt, detail: item.album?.title ? `accès ouvert : ${item.album.title}` : 'accès privé ouvert' }));
    if (active === 'Tout' || active === 'Demandes en attente') add('Demande album', social.pendingAlbumRequests, (item) => ({ profile: item.viewer || item.owner, date: item.requestedAt || item.createdAt, detail: item.album?.title ? `demande : ${item.album.title}` : 'demande en attente' }));
    return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, active === 'Tout' ? 50 : 100);
  }
  const rows = itemsFor(tab);
  return (
    <section className="social-interactions-page-v149">
      <div className="section-heading compact">
        <p className="eyebrow">Interactions</p>
        <h2>Votre activité sociale</h2>
        <p>Réactions, commentaires, visites, matchs et albums privés au même endroit.</p>
      </div>
      <div className="interaction-tabs-v149">
        {sections.map(([label, count]) => <button type="button" key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>{label}<em>{count || 0}</em></button>)}
      </div>
      <div className="interaction-list-v149">
        {rows.map((item, index) => (
          <article className="interaction-card-v149 glass" key={`${item.type}-${item.profile?.id || index}-${item.date || index}`}>
            <Avatar profile={item.profile} />
            <div>
              <strong>{item.profile?.pseudo || 'Profil'}</strong>
              <p><b>{item.type}</b> · {item.detail}</p>
              {item.media ? <small>Média : {item.media.title || 'publication'} · {formatDate(item.date)}</small> : <small>{formatDate(item.date)}</small>}
            </div>
            <div className="interaction-actions-v149">
              <button type="button" onClick={() => item.profile && onOpenProfile?.(item.profile)}>Profil</button>
              <button type="button" onClick={() => item.profile?.id && onMessage?.(item.profile.id)}>Message</button>
              <button type="button" onClick={() => item.profile?.id && onFollow?.(item.profile.id)}>Suivre</button>
              <button type="button" onClick={() => item.profile && onReport?.(item.profile, 'social_interactions')}>Signaler</button>
              <button type="button" className="danger" onClick={() => item.profile?.id && onBlock?.(item.profile.id)}>Bloquer</button>
            </div>
          </article>
        ))}
        {!rows.length ? <ActionEmptyState icon="✨" title="Aucune interaction pour le moment." subtitle="Ajoutez des photos, complétez votre profil et échangez avec des profils compatibles pour recevoir plus de réactions." primaryLabel="Découvrir des profils" onPrimary={() => onNavigate?.('Découvrir')} tips={["Les profils avec photos reçoivent plus de réactions.", "Les commentaires respectueux créent plus de conversations."]} /> : null}
      </div>
    </section>
  );
}

function AccountHub({ activeSubTab = 'Mon profil', onSubTabChange, me, options, onSaved, showToast, plans, subscription, onActivate, onCheckout, blockedProfiles = [], onUnblock, onSaveNotificationPreferences, onSaveSocialPreferences, onContactSupport }) {
  const notificationPrefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(me?.notificationPreferences || {}) };
  const enabledCount = Object.values(notificationPrefs).filter(Boolean).length;
  const items = [
    { id: 'Mon profil', icon: 'profile', label: 'Profil', description: 'Identité & préférences', badge: me?.profilePhotoUrl ? 'OK' : 'À finir' },
    { id: 'Abonnement', icon: 'premium', label: 'Premium', description: 'Accès & codes', badge: subscription?.active || me?.role === 'admin' ? 'Actif' : '' },
    { id: 'Paramètres', icon: 'settings', label: 'Paramètres', description: 'Notifications & support', badge: `${enabledCount}/${NOTIFICATION_PREFERENCE_ITEMS.length}` },
    { id: 'Confidentialité', icon: 'privacy', label: 'Sécurité', description: 'Blocages & règles', badge: blockedProfiles.length ? `${blockedProfiles.length}` : '' },
  ];
  const active = items.some((item) => item.id === activeSubTab) ? activeSubTab : 'Mon profil';
  return (
    <section className="page hub-page-v65 account-hub-v65">
      <HubHeader eyebrow="Mon espace" title="Profil, abonnement, sécurité" description="Gérez votre profil, votre abonnement et vos paramètres" />
      <HubSubNav items={items} active={active} onChange={onSubTabChange} />
      <div className="hub-content-v65">
        {active === 'Mon profil' ? <MyProfile me={me} options={options} onSaved={onSaved} showToast={showToast} /> : null}
        {active === 'Abonnement' ? <SubscriptionPage plans={plans} subscription={subscription} onActivate={onActivate} onCheckout={onCheckout} showToast={showToast} /> : null}
        {active === 'Paramètres' ? <SettingsPage me={me} onSaveNotificationPreferences={onSaveNotificationPreferences} onContactSupport={onContactSupport} showToast={showToast} /> : null}
        {active === 'Confidentialité' ? <PrivacyPage me={me} blockedProfiles={blockedProfiles} onUnblock={onUnblock} onSaveSocialPreferences={onSaveSocialPreferences} showToast={showToast} /> : null}
      </div>
    </section>
  );
}

function LikePreviewCard({ incomingLikes = [], onNavigate }) {
  const count = incomingLikes.length;
  if (!count) return null;
  const previews = incomingLikes.slice(0, 3);
  const extra = count > 3 ? count - 3 : 0;
  return (
    <button
      type="button"
      className="like-preview-card-v99"
      onClick={() => onNavigate('Découvrir')}
      aria-label={`${count} personne${count > 1 ? 's' : ''} vous a liké — voir qui`}
    >
      <div className="lpc-avatars-v99">
        {previews.map((item, i) => (
          <div
            key={item.id || i}
            className="lpc-avatar-v99"
            style={item.profile?.profilePhotoUrl ? { backgroundImage: `url(${item.profile.profilePhotoUrl})` } : {}}
            aria-hidden="true"
          />
        ))}
        {extra > 0 && (
          <div className="lpc-avatar-v99 lpc-avatar-extra-v99" aria-hidden="true">
            +{extra}
          </div>
        )}
      </div>
      <div className="lpc-body-v99">
        <strong>{count} personne{count > 1 ? 's' : ''} vous a liké</strong>
        <span>Découvrez qui — avant qu'ils disparaissent</span>
      </div>
      <div className="lpc-arrow-v99" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h13"/><path d="m13 6 6 6-6 6"/>
        </svg>
      </div>
    </button>
  );
}

function feedMediaSrc(url = '') {
  const src = String(url || '').trim();
  if (!src) return '';
  if (src.startsWith('/api/')) return src;
  return src;
}

function relativeTimeLabel(value) {
  if (!value) return 'à l’instant';
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'à l’instant';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return formatShortDate(value);
}

function feedVisibilityLabel(value) {
  return ({ public: 'Public', verified: 'Membres vérifiés', favorites: 'Mes favoris', private: 'Privé' })[value] || 'Public';
}

function normalizeHomePost(raw = {}) {
  const author = raw.author || raw.owner || {};
  return {
    id: raw.id,
    source: raw.source || 'feed',
    mediaId: raw.mediaId || raw.media_id || raw.media?.id || '',
    userId: raw.userId || raw.user_id || author.id || raw.ownerId || '',
    pseudo: raw.pseudo || author.pseudo || 'Membre',
    avatar: raw.avatar || author.profilePhotoUrl || raw.profilePhotoUrl || defaultProfilePhoto(raw.pseudo || author.pseudo || 'M'),
    location: raw.location || raw.localisation || author.city || raw.city || '',
    distanceKm: raw.distanceKm ?? raw.distance ?? author.distanceKm,
    text: raw.text || raw.texte || raw.caption || raw.media?.caption || '',
    mediaUrl: raw.mediaUrl || raw.media_url || raw.media?.url || raw.media?.dataUrl || '',
    mediaType: raw.mediaType || raw.media_type || (raw.media?.type === 'video' ? 'video' : raw.media?.type === 'photo' ? 'image' : 'none'),
    visibility: raw.visibility || 'public',
    likesCount: Number(raw.likesCount ?? raw.likes_count ?? raw.media?.likeCount ?? 0),
    commentsCount: Number(raw.commentsCount ?? raw.comments_count ?? raw.media?.commentCount ?? (Array.isArray(raw.comments) ? raw.comments.length : 0) ?? 0),
    liked: Boolean(raw.liked || raw.media?.liked),
    comments: Array.isArray(raw.comments) ? raw.comments : Array.isArray(raw.media?.comments) ? raw.media.comments : [],
    createdAt: raw.createdAt || raw.created_at || raw.media?.createdAt || new Date().toISOString(),
    author,
    mine: Boolean(raw.mine),
  };
}

function fallbackHomePostsFromProfiles(profiles = [], me = {}) {
  return profiles
    .filter((profile) => profile && profile.id !== me?.id && !profile.hidden && !profile.blockedByMe && !profile.blockingMe)
    .flatMap((profile) => (profile.albums || [])
      .filter((album) => album.visibility === 'public' || album.unlocked)
      .flatMap((album) => (album.items || []).map((media) => normalizeHomePost({
        id: `media-${media.id}`,
        source: 'media',
        mediaId: media.id,
        author: profile,
        location: profile.city,
        distanceKm: profile.distanceKm,
        text: media.caption || media.title || `Publié dans ${album.title || 'un album public'}.`,
        mediaUrl: mediaDisplayUrl(media, profile),
        mediaType: media.type === 'video' ? 'video' : 'image',
        likesCount: media.likeCount || media.heartCount || 0,
        commentsCount: media.commentCount || (media.comments || []).length || 0,
        liked: media.liked,
        comments: media.comments || [],
        createdAt: media.createdAt,
      }))))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 30);
}

function UserHomePage({ data = {}, onNavigate, onOpenOnboarding, onPublish, onLike, onComment, onMediaLike, onMediaComment, onHide, onReport, onReportProfile, onBlock, onMessage, onOpenProfile, onRefresh, showToast }) {
  const me = data.me || {};
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const feedPosts = Array.isArray(data.feedPosts) ? data.feedPosts.map(normalizeHomePost) : [];
  const fallbackPosts = useMemo(() => fallbackHomePostsFromProfiles(profiles, me), [profiles, me]);
  const [filter, setFilter] = useState('Tous');
  const [composerOpen, setComposerOpen] = useState(false);
  const filters = ['Tous', 'Photos', 'Vidéos', 'Près de moi', 'Nouveaux', 'Populaires'];
  const sourcePosts = feedPosts.length ? feedPosts : fallbackPosts;
  const activeProfiles = profiles
    .filter((profile) => profile && profile.id !== me?.id && !profile.hidden && !profile.blockedByMe && !profile.blockingMe)
    .sort((a, b) => Number(b.online || 0) - Number(a.online || 0) || distanceValue(a) - distanceValue(b))
    .slice(0, 14);
  const suggestedProfiles = profiles
    .filter((profile) => profile && profile.id !== me?.id && !profile.hidden && !profile.blockedByMe && !profile.blockingMe)
    .sort((a, b) => profileCompatibilityScore(b, me) - profileCompatibilityScore(a, me) || distanceValue(a) - distanceValue(b))
    .slice(0, 4);

  const posts = useMemo(() => {
    let rows = [...sourcePosts];
    if (filter === 'Photos') rows = rows.filter((post) => post.mediaType === 'image');
    if (filter === 'Vidéos') rows = rows.filter((post) => post.mediaType === 'video');
    if (filter === 'Près de moi') rows = rows.filter((post) => Number(post.distanceKm || 999999) <= 50);
    if (filter === 'Populaires') rows.sort((a, b) => ((b.likesCount || 0) + (b.commentsCount || 0) * 2) - ((a.likesCount || 0) + (a.commentsCount || 0) * 2));
    else rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return rows;
  }, [sourcePosts, filter]);

  async function handlePublish(payload) {
    await onPublish?.(payload);
    setComposerOpen(false);
    await onRefresh?.({ silent: true });
  }

  return (
    <section className="page social-home-v178">
      <header className="social-home-header-v178">
        <div>
          <p className="eyebrow">Accueil</p>
          <h2>{greetingByHour()}{me.pseudo ? `, ${me.pseudo}` : ''} <span aria-hidden="true">👋</span></h2>
          <p>Découvrez les moments partagés par la communauté.</p>
        </div>
        <div className="social-home-header-actions-v178">
          <button type="button" className="social-icon-btn-v178" onClick={() => onNavigate?.('Notifications')} aria-label="Notifications"><Icon name="notifications" /></button>
          <button type="button" className="social-icon-btn-v178" onClick={() => onNavigate?.('Paramètres')} aria-label="Menu"><Icon name="settings" /></button>
        </div>
      </header>

      <section className="composer-card-v178 glass" aria-label="Créer une publication">
        <Avatar profile={me} />
        <button type="button" className="composer-placeholder-v178" onClick={() => setComposerOpen(true)}>Partager un moment avec la communauté...</button>
        <div className="composer-actions-v178">
          <button type="button" onClick={() => setComposerOpen(true)}><Icon name="albums" />Photo</button>
          <button type="button" onClick={() => setComposerOpen(true)}><Icon name="video" />Vidéo</button>
          <button type="button" onClick={() => setComposerOpen(true)}><Icon name="feed" />Message</button>
        </div>
      </section>

      <section className="active-members-v178" aria-label="Membres actifs">
        {activeProfiles.length ? activeProfiles.map((profile) => (
          <button type="button" key={profile.id} className="active-member-v178" onClick={() => onOpenProfile?.(profile.id)}>
            <span className="active-avatar-wrap-v178"><Avatar profile={profile} />{profile.online ? <i aria-label="en ligne" /> : null}</span>
            <strong>{profile.pseudo || 'Membre'}</strong>
          </button>
        )) : (
          <div className="active-member-empty-v178">Les membres actifs apparaîtront ici.</div>
        )}
      </section>

      <nav className="feed-filter-row-v178" aria-label="Filtres du fil">
        {filters.map((item) => <button type="button" key={item} className={cx(filter === item && 'active')} onClick={() => setFilter(item)}>{item}</button>)}
      </nav>

      <div className="feed-list-v178">
        {!posts.length ? (
          <div className="feed-empty-v178 glass">
            <strong>Aucune publication pour le moment.</strong>
            <span>Soyez le premier à partager un moment.</span>
            <button type="button" className="primary-btn" onClick={() => setComposerOpen(true)}>Publier</button>
          </div>
        ) : posts.map((post, index) => (
          <React.Fragment key={post.id}>
            <HomeFeedPostCard
              post={post}
              onLike={post.source === 'media' ? () => onMediaLike?.(post.mediaId, 'heart') : () => onLike?.(post.id)}
              onComment={post.source === 'media' ? (body) => onMediaComment?.(post.mediaId, body) : (body) => onComment?.(post.id, body)}
              onMessage={() => onMessage?.(post.userId)}
              onOpenProfile={() => onOpenProfile?.(post.userId)}
              onHide={post.source === 'media' ? null : () => onHide?.(post.id)}
              onReport={post.source === 'media' ? () => onReportProfile?.(post.author || post.userId, 'feed_media') : (reason) => onReport?.(post.id, reason)}
              onBlock={() => onBlock?.(post.userId)}
              showToast={showToast}
            />
            {index === 2 && suggestedProfiles.length ? <HomeSuggestionsCard profiles={suggestedProfiles} onOpenProfile={onOpenProfile} onNavigate={onNavigate} me={me} /> : null}
          </React.Fragment>
        ))}
      </div>

      {composerOpen ? <HomePostComposer me={me} onClose={() => setComposerOpen(false)} onSubmit={handlePublish} showToast={showToast} /> : null}
    </section>
  );
}

function HomePostComposer({ me, onClose, onSubmit, showToast }) {
  const fileInputRef = useRef(null);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [accept, setAccept] = useState('image/*,video/*');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function chooseFile(kind) {
    setAccept(kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : 'image/*,video/*');
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  function selectFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/') && !nextFile.type.startsWith('video/')) {
      showToast?.('Choisis une photo ou une vidéo.');
      return;
    }
    if (nextFile.size > TOKTAK_VIDEO_MAX_BYTES) {
      showToast?.('Média trop lourd : maximum 25 Mo.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function submit(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText && !file) { showToast?.('Ajoute un texte, une photo ou une vidéo.'); return; }
    setBusy(true);
    try {
      let dataUrl = '';
      if (file) dataUrl = await readFileAsDataUrl(file);
      await onSubmit?.({
        text: cleanText,
        visibility,
        mediaType: file?.type?.startsWith('video/') ? 'video' : file ? 'image' : 'none',
        dataUrl,
        mimeType: file?.type || '',
        filename: file?.name || '',
      });
    } catch (err) {
      showToast?.(err.message || 'Publication impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home-composer-backdrop-v178" role="dialog" aria-modal="true" aria-label="Créer une publication">
      <form className="home-composer-modal-v178" onSubmit={submit}>
        <div className="home-composer-head-v178">
          <div><Avatar profile={me} /><span><strong>Créer une publication</strong><small>Contenu adulte +18, consentement et respect obligatoires.</small></span></div>
          <button type="button" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Partager un moment avec la communauté..." rows={5} data-allow-text-focus="true" />
        {previewUrl ? (
          <div className="home-composer-preview-v178">
            {file?.type?.startsWith('video/') ? <video src={previewUrl} controls playsInline /> : <img src={previewUrl} alt="Aperçu" />}
            <button type="button" onClick={() => { setFile(null); setPreviewUrl(''); }}>Retirer</button>
          </div>
        ) : null}
        <input ref={fileInputRef} type="file" accept={accept} hidden onChange={(event) => selectFile(event.target.files?.[0])} />
        <div className="home-composer-tools-v178">
          <button type="button" onClick={() => chooseFile('image')}><Icon name="albums" />Photo</button>
          <button type="button" onClick={() => chooseFile('video')}><Icon name="video" />Vidéo</button>
          <button type="button" onClick={() => setText((current) => current || '')}><Icon name="feed" />Message</button>
        </div>
        <label className="home-composer-visibility-v178">Visibilité
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)} data-allow-text-focus="true">
            <option value="public">Public</option>
            <option value="verified">Membres vérifiés</option>
            <option value="favorites">Mes favoris</option>
            <option value="private">Privé</option>
          </select>
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Publication…' : 'Publier'}</button>
      </form>
    </div>
  );
}

function HomeFeedPostCard({ post: rawPost, onLike, onComment, onMessage, onOpenProfile, onHide, onReport, onBlock, showToast }) {
  const post = normalizeHomePost(rawPost);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [busyComment, setBusyComment] = useState(false);
  const mediaUrl = feedMediaSrc(post.mediaUrl);
  const distanceText = post.distanceKm === null || post.distanceKm === undefined ? '' : (Number(post.distanceKm) <= 0 ? 'Même ville' : `à ${Math.round(Number(post.distanceKm))} km`);

  async function submitComment(event) {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body) return;
    setBusyComment(true);
    try {
      await onComment?.(body);
      setCommentBody('');
      setCommentOpen(true);
    } catch (err) {
      showToast?.(err.message || 'Commentaire impossible.');
    } finally {
      setBusyComment(false);
    }
  }

  async function report() {
    const reason = window.prompt('Pourquoi signaler cette publication ?');
    if (reason === null) return;
    if (!reason.trim()) { showToast?.('Détail du signalement obligatoire.'); return; }
    await onReport?.(reason.trim());
  }

  return (
    <article className="feed-post-card-v178 glass">
      <header className="feed-post-head-v178">
        <button type="button" className="feed-author-v178" onClick={onOpenProfile}>
          <Avatar profile={{ pseudo: post.pseudo, profilePhotoUrl: post.avatar }} />
          <span><strong>{post.pseudo}</strong><small>{[post.location, distanceText, relativeTimeLabel(post.createdAt)].filter(Boolean).join(' • ')}</small></span>
        </button>
        <details className="feed-post-menu-v178">
          <summary aria-label="Options">…</summary>
          <div>
            {onReport && !post.mine ? <button type="button" onClick={report}>Signaler</button> : null}
            {onBlock && !post.mine ? <button type="button" onClick={onBlock}>Bloquer</button> : null}
            {onHide ? <button type="button" onClick={onHide}>Masquer cette publication</button> : null}
          </div>
        </details>
      </header>
      {post.text ? <p className="feed-post-text-v178">{post.text}</p> : null}
      {mediaUrl ? (
        <div className={cx('feed-post-media-v178', post.mediaType === 'video' && 'video')}>
          {post.mediaType === 'video' ? <video src={mediaUrl} controls playsInline preload="metadata" /> : <img src={mediaUrl} alt="Publication" loading="lazy" />}
        </div>
      ) : null}
      <div className="feed-post-meta-v178"><span>❤️ {post.likesCount}</span><span>💬 {post.commentsCount}</span><span>{feedVisibilityLabel(post.visibility)}</span></div>
      <div className="feed-post-actions-v178">
        <button type="button" className={cx(post.liked && 'active')} onClick={onLike}>{post.liked ? '❤️ Aimé' : '♡ J’aime'}</button>
        <button type="button" onClick={() => setCommentOpen((value) => !value)}>💬 Commenter</button>
        {!post.mine ? <button type="button" onClick={onMessage}>💌 Message privé</button> : null}
        <button type="button" onClick={onOpenProfile}>Voir le profil</button>
      </div>
      {commentOpen ? (
        <div className="feed-comments-v178">
          {(post.comments || []).slice(-3).map((comment) => (
            <div key={comment.id} className="feed-comment-v178"><strong>{comment.pseudo || comment.author?.pseudo || 'Membre'}</strong><span>{comment.text || comment.body}</span></div>
          ))}
          <form onSubmit={submitComment}>
            <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Écrire un commentaire respectueux..." data-allow-text-focus="true" />
            <button type="submit" disabled={busyComment}>Envoyer</button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function HomeSuggestionsCard({ profiles = [], onOpenProfile, onNavigate, me }) {
  return (
    <section className="home-suggestions-v178 glass">
      <div className="home-suggestions-head-v178"><span><p className="eyebrow">Suggestions</p><h3>Profils qui pourraient vous plaire</h3></span><button type="button" className="small-btn" onClick={() => onNavigate?.('Découvrir')}>Voir plus</button></div>
      <div className="home-suggestion-grid-v178">
        {profiles.map((profile) => (
          <article key={profile.id}>
            <Avatar profile={profile} />
            <strong>{profile.pseudo || 'Profil'}</strong>
            <small>{distanceLabel(profile)}</small>
            <CompatibilityPill profile={profile} me={me} compact />
            <button type="button" onClick={() => onOpenProfile?.(profile.id)}>Voir</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedPage({ profiles, me, conversations = [], subscription, onFollow, onMessage, onOpenProfile, onLike, onComment, onCommentLike, onCommentDelete, onNavigate }) {
  const [radius, setRadius] = useState(SEARCH_RADIUS_MAX_KM);
  const [maxAge, setMaxAge] = useState(65);
  const [category, setCategory] = useState('Tous');
  const [photoOnly, setPhotoOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [feedMode, setFeedMode] = useState('smart');

  const nearby = useMemo(() => profiles
    .filter((p) => !p.hidden)
    .filter((p) => category === 'Tous' || normalize(p.category || p.type) === normalize(category))
    .filter((p) => distanceValue(p) <= Number(radius))
    .filter((p) => profileAgeMatches(p, 18, maxAge))
    .filter((p) => !photoOnly || hasPersonalProfilePhoto(p))
    .filter((p) => !onlineOnly || Boolean(p.online))
    .sort((a, b) => distanceValue(a) - distanceValue(b)), [profiles, radius, maxAge, category, photoOnly, onlineOnly]);

  const mediaEntries = useMemo(() => {
    return profiles
      .filter((profile) => !profile.hidden)
      .filter((profile) => profileAgeMatches(profile, 18, maxAge))
      .flatMap((profile) => (profile.albums || [])
        .filter((album) => album.visibility === 'public' || album.unlocked)
        .flatMap((album) => (album.items || []).map((media) => ({
          id: `${profile.id}_${album.id}_${media.id}`,
          owner: profile,
          album,
          media,
          distanceKm: distanceValue(profile),
          isFollowing: Boolean(profile.followedByMe),
          isNearby: distanceValue(profile) <= Number(radius),
        }))))
      .sort((a, b) => new Date(b.media.createdAt || 0) - new Date(a.media.createdAt || 0));
  }, [profiles, radius, maxAge]);

  const followedMedia = useMemo(() => mediaEntries.filter((entry) => entry.isFollowing), [mediaEntries]);
  const discoveryMedia = useMemo(() => mediaEntries
    .filter((entry) => entry.isNearby)
    .sort((a, b) => {
      const videoBoost = (b.media.type === 'video') - (a.media.type === 'video');
      if (videoBoost) return videoBoost;
      const distance = (a.distanceKm || 999999) - (b.distanceKm || 999999);
      if (distance) return distance;
      return String(a.media.id).localeCompare(String(b.media.id));
    }), [mediaEntries]);
  const allMedia = mediaEntries;
  const smartFeed = followedMedia.length ? followedMedia : discoveryMedia;
  const feedItems = feedMode === 'all' ? allMedia : smartFeed;
  const recentVideos = useMemo(() => mediaEntries.filter((entry) => entry.media.type === 'video').slice(0, 6), [mediaEntries]);
  const featuredAlbums = profiles.flatMap((profile) => (profile.albums || []).map((album) => ({ profile, album }))).slice(0, 4);
  const recentMessages = conversations.slice(0, 4);
  const fallbackMode = !followedMedia.length;

  return (
    <section className="luxe-dashboard page feed-news-page">
      <aside className="dashboard-search glass">
        <p className="eyebrow">Recherche</p>
        <div className="location-block"><span>⌖</span><div><strong>Autour de moi</strong><small>{me.city || 'Paris'}, France</small></div><button type="button">✎</button></div>
        <label className="luxe-slider"><span>Distance <b>{radiusLabel(radius)}</b></span><input type="range" min="10" max={SEARCH_RADIUS_MAX_KM} step="10" value={radius} onChange={(e) => setRadius(e.target.value)} /><small><em>10 km</em><em>{SEARCH_RADIUS_MAX_KM} km</em></small></label>
        <div className="segmented-title">Je recherche</div>
        <div className="filter-pills">
          {['Couple', 'Femme', 'Homme', 'Trans', 'Trio', 'Groupe', 'Tous'].map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item === 'Tous' ? '◎ Tous' : item}</button>)}
        </div>
        <label className="luxe-slider"><span>Âge <b>18 - {maxAge >= 65 ? '65+' : maxAge}</b></span><input type="range" min="18" max="65" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} /><small><em>18</em><em>65+</em></small></label>
        <div className="checks-stack">
          <label><input type="checkbox" checked={photoOnly} onChange={(e) => setPhotoOnly(e.target.checked)} /> Photo personnelle uniquement</label>
          <label><input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> En ligne maintenant</label>
          <label><input type="checkbox" /> Nouveaux membres</label>
        </div>
        <button type="button" className="primary-wine full">⌕ Rechercher</button>
        <button type="button" className="reset-link" onClick={() => { setRadius(SEARCH_RADIUS_MAX_KM); setMaxAge(65); setCategory('Tous'); setPhotoOnly(false); setOnlineOnly(false); }}>↻ Réinitialiser les filtres</button>
      </aside>

      <div className="dashboard-main">
        <div className="feed-hero-panel glass">
          <div>
            <p className="eyebrow">Fil d’actualité</p>
            <h2>{feedMode === 'all' ? 'Photos & vidéos de tous les membres' : followedMedia.length ? 'Actualités de vos abonnements' : 'Découverte autour de vous'}</h2>
          </div>
          <div className="feed-tabs" role="tablist" aria-label="Choix du fil d’actualité">
            <button type="button" className={feedMode === 'smart' ? 'active' : ''} onClick={() => setFeedMode('smart')}>Mon fil</button>
            <button type="button" className={feedMode === 'all' ? 'active' : ''} onClick={() => setFeedMode('all')}>Tous les médias</button>
          </div>
        </div>

        {feedMode === 'smart' && fallbackMode ? (
          <div className="feed-alert glass">
            <strong>Votre fil est en mode découverte.</strong>
            <span>Suivez des profils pour personnaliser cette page. En attendant, nous affichons des contenus proches de vous.</span>
          </div>
        ) : null}

        {recentVideos.length ? (
          <section className="new-videos-strip glass">
            <div className="panel-title-row small"><h3>▶ Nouvelles vidéos Toktak</h3><button type="button" onClick={() => onNavigate?.('Toktak')}>Ouvrir Toktak</button></div>
            <div className="video-suggestions-row">
              {recentVideos.map((entry) => <button type="button" className="video-suggestion" key={entry.id} onClick={() => setFeedMode('all')}><span style={{ backgroundImage: `url(${entry.owner.profilePhotoUrl || ''})` }}>▶</span><strong>{entry.media.title}</strong><small>{entry.owner.pseudo} • {distanceLabel(entry.owner)}</small></button>)}
            </div>
          </section>
        ) : null}

        <div className="panel-title-row"><h2>{feedMode === 'all' ? 'Tous les médias publiés' : 'Publications récentes'}</h2><button type="button" onClick={() => onNavigate?.('Recherche')}>Trouver des profils ›</button></div>
        <div className="activity-feed-list">
          {feedItems.slice(0, feedMode === 'all' ? 40 : 18).map((entry) => <FeedMediaCard key={entry.id} entry={entry} onFollow={onFollow} onLike={onLike} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} />)}
          {!feedItems.length && <EmptyState title="Aucune publication visible pour le moment." />}
        </div>

        <div className="premium-banner glass">
          <div className="crown">♕</div><div><h3>Premium</h3></div><button type="button" className="gold-btn" onClick={() => onNavigate?.('Abonnement')}>Voir</button>
        </div>
      </div>

      <aside className="dashboard-side">
        <article className="glass side-card follow-suggestions-card">
          <div className="panel-title-row small"><h3>Profils proches</h3><button type="button" onClick={() => onNavigate?.('Recherche')}>Voir tout</button></div>
          <div className="nearby-mini-list">
            {nearby.slice(0, 5).map((profile) => <button type="button" key={profile.id} onClick={() => onOpenProfile?.(profile)}><Avatar profile={profile} /><span><strong>{profile.pseudo}</strong><small>{distanceLabel(profile)} • {profile.category || profile.type}</small></span><em>Profil</em></button>)}
          </div>
        </article>
        <article className="glass side-card featured-albums">
          <div className="panel-title-row small"><h3>Albums à la une</h3><button type="button" onClick={() => onNavigate?.('Albums')}>Voir tout</button></div>
          <div className="album-mini-grid">
            {featuredAlbums.slice(0, 2).map(({ profile, album }) => <div className="album-mini" key={album.id}><div className="album-cover" style={{ backgroundImage: `url(${profile.profilePhotoUrl || ''})` }}><span>{album.visibility === 'private' ? '🔒' : '✦'}</span></div><strong>{album.visibility === 'private' ? 'Album privé' : 'Album public'}</strong><small>{album.title}</small><em><svg className="nav-icon-v101" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="13" rx="2" /><path d="m4 14 4-3 3 2 4-4 5 4" /><circle cx="9" cy="9" r="1.2" /></svg> {(album.items || []).length || album.mediaCount || 12}</em></div>)}
          </div>
          <button type="button" className="outline-wide" onClick={() => onNavigate?.('Albums')}>Explorer les albums</button>
        </article>
        <article className="glass side-card recent-messages">
          <div className="panel-title-row small"><h3>Messages récents</h3><button type="button" onClick={() => onNavigate?.('Messages')}>Voir tout</button></div>
          <div className="message-mini-list">
            {recentMessages.map((c, index) => <button type="button" key={c.id || index} onClick={() => onNavigate?.('Messages')}><Avatar profile={c.participant} /><span><strong>{c.participant?.pseudo || 'Profil'}</strong><small>{c.lastMessage?.body || 'Nouvelle conversation'}</small></span><em>{index < 2 ? index + 1 : ''}</em></button>)}
            {!recentMessages.length && <EmptyState title="Aucun message récent." />}
          </div>
          <button type="button" className="outline-wide" onClick={() => onNavigate?.('Messages')}>⌕ Ouvrir mes messages</button>
        </article>
      </aside>
    </section>
  );
}

function FeedMediaCard({ entry, onFollow, onLike, onComment, onCommentLike, onCommentDelete }) {
  const { owner, album, media, distanceKm, isFollowing } = entry;
  return (
    <article className="glass feed-media-card pro-feed-card">
      <div className="feed-media-visual" style={{ backgroundImage: `url(${owner.profilePhotoUrl || ''})` }}>
        <span className={media.type === 'video' ? 'media-type-badge video' : 'media-type-badge'}>{media.type === 'video' ? '▶ Vidéo' : 'Photo'}</span>
        {album.visibility === 'private' ? <span className="media-lock-badge">🔒 Album privé ouvert</span> : <span className="media-lock-badge public">Album public</span>}
      </div>
      <div className="feed-media-body">
        <div className="feed-author-row">
          <Avatar profile={owner} />
          <div><strong>{owner.pseudo}</strong><small>{distanceLabel(owner)} • {isFollowing ? 'Profil suivi' : 'Découverte proche'}</small></div>
          <button type="button" className={cx('small-btn', owner.followedByMe && 'gold')} onClick={() => onFollow(owner.id)}>{owner.followedByMe ? 'Suivi' : 'Suivre'}</button>
        </div>
        <h3>{media.title}</h3>
        <p>{media.caption || `Publié dans ${album.title}.`}</p>
        <div className="feed-media-meta"><span>{album.title}</span><span>{formatDate(media.createdAt)}</span></div>
        <SocialEngagementPanel media={media} onLike={onLike} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} />
      </div>
    </article>
  );
}

function ReactionBar({ media, onReact, compact = false }) {
  const counts = media.reactionCounts || {};
  const total = Number(media.likeCount || Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0));
  const [pulse, setPulse] = useState('');
  function click(reaction) {
    setPulse(reaction);
    window.setTimeout(() => setPulse(''), 520);
    onReact?.(reaction);
  }
  return (
    <div className={cx('reaction-bar-v149', compact && 'compact')} aria-label="Réactions média">
      {MEDIA_REACTION_OPTIONS.map((item) => {
        const active = media.myReaction === item.id || (item.id === 'heart' && media.liked && !media.myReaction);
        const count = Number(counts[item.id] || 0);
        return (
          <button type="button" key={item.id} className={cx(active && 'active', pulse === item.id && 'pulse')} aria-pressed={active} onClick={() => click(item.id)} title={item.label}>
            <span>{item.emoji}</span><em>{count || ''}</em>
          </button>
        );
      })}
      <strong>{total || 0}</strong>
    </div>
  );
}

function renderMentionedText(body = '') {
  const parts = String(body || '').split(/(@[\p{L}\p{N}_ .-]{2,40})/gu);
  return parts.map((part, index) => part.startsWith('@') ? <mark key={`${part}-${index}`} className="comment-mention-v149">{part}</mark> : <React.Fragment key={index}>{part}</React.Fragment>);
}

function SocialEngagementPanel({ media, onLike, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, compact = false, video = false }) {
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(Boolean((media.comments || []).length));
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState('recent');
  const comments = Array.isArray(media.comments) ? media.comments : [];
  const sortedComments = comments.slice().sort((a, b) => sort === 'popular' ? Number(b.likeCount || 0) - Number(a.likeCount || 0) : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const visibleComments = showAll ? sortedComments : sortedComments.slice(0, 3);
  const likeCount = Number(media.likeCount || 0);
  const commentCount = Number(media.commentCount || comments.length || 0);
  const likePreview = Array.isArray(media.likePreview) ? media.likePreview.filter(Boolean).slice(0, 3) : [];

  async function submit(e) {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    await onComment(media.id, body);
    setComment('');
    setOpen(true);
  }
  function addEmoji(emoji) {
    setComment((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}${emoji} `);
  }

  return (
    <div className={cx('social-engagement-panel', 'social-engagement-panel-v149', compact && 'compact', video && 'video-mode')}>
      <div className="social-action-bar social-action-bar-v149">
        <ReactionBar media={media} compact={compact} onReact={(reaction) => onLike?.(media.id, reaction)} />
        <button type="button" className="social-comment-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span>💬</span>
          <strong>Commenter</strong>
        </button>
        <div className="social-counts">
          <span>{likeCount} réaction{likeCount > 1 ? 's' : ''}</span>
          <span>{commentCount} commentaire{commentCount > 1 ? 's' : ''}</span>
        </div>
      </div>

      {likePreview.length ? (
        <div className="like-preview-row">
          <div className="like-preview-avatars">{likePreview.map((profile) => <Avatar key={profile.id} profile={profile} />)}</div>
          <span>Réagi par {likePreview.map((profile) => profile.pseudo).join(', ')}{likeCount > likePreview.length ? ` et ${likeCount - likePreview.length} autre${likeCount - likePreview.length > 1 ? 's' : ''}` : ''}</span>
        </div>
      ) : null}

      {(open || comments.length > 0) ? (
        <div className="comments-zone comments-zone-v149">
          <div className="comments-zone-head">
            <strong>Commentaires</strong>
            <span className="comment-sort-v149">
              <button type="button" className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>Récents</button>
              <button type="button" className={sort === 'popular' ? 'active' : ''} onClick={() => setSort('popular')}>Populaires</button>
            </span>
            {comments.length > 3 ? <button type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Réduire' : `Voir tout`}</button> : null}
          </div>
          <div className="comment-list-pro">
            {visibleComments.map((item) => <CommentItem key={item.id} mediaId={media.id} comment={item} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} />)}
            {!comments.length ? <p className="empty-comments">Aucun commentaire pour le moment. Ajoutez une réaction ou lancez la discussion.</p> : null}
          </div>
          <form className="comment-form pro-comment-form" onSubmit={submit}>
            <div className="comment-emoji-row" aria-label="Emojis rapides">
              {COMMENT_QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => addEmoji(emoji)}>{emoji}</button>)}
            </div>
            <div className="comment-input-row">
              <input value={comment} maxLength={600} onChange={(e) => setComment(e.target.value)} placeholder="Écrire un commentaire respectueux… Utilisez @pseudo pour mentionner." />
              <button type="submit" className="small-btn" disabled={!comment.trim()}>Publier</button>
            </div>
            <small>{comment.length}/600</small>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function CommentItem({ mediaId, comment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, level = 0 }) {
  const author = comment.author || { pseudo: 'Membre' };
  const likeCount = Number(comment.likeCount || 0);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  async function submitReply(e) {
    e.preventDefault();
    const body = reply.trim();
    if (!body) return;
    await onCommentReply?.(mediaId, comment.id, body);
    setReply('');
    setReplying(false);
  }
  return (
    <article className={cx('comment-item-pro', 'comment-item-v149', level > 0 && 'reply')}>
      <Avatar profile={author} />
      <div className="comment-bubble-pro">
        <div className="comment-meta-pro"><strong>{author.pseudo || 'Membre'}</strong><span>{formatDate(comment.createdAt)}</span>{comment.pinned ? <em>Épinglé</em> : null}</div>
        <p>{renderMentionedText(comment.body)}</p>
        <div className="comment-actions-pro">
          <button type="button" className={cx(comment.liked && 'active')} onClick={() => onCommentLike?.(mediaId, comment.id)}>{comment.liked ? '♥ Aimé' : '♡ J’aime'} {likeCount ? <span>{likeCount}</span> : null}</button>
          {level < 1 ? <button type="button" onClick={() => setReplying((value) => !value)}>Répondre</button> : null}
          <button type="button" onClick={() => onCommentReport?.(mediaId, comment.id)}>Signaler</button>
          {comment.canPin ? <button type="button" onClick={() => onCommentPin?.(mediaId, comment.id)}>{comment.pinned ? 'Désépingler' : 'Épingler'}</button> : null}
          {comment.canDelete ? <button type="button" className="danger" onClick={() => onCommentDelete?.(mediaId, comment.id)}>Supprimer</button> : null}
        </div>
        {replying ? (
          <form className="comment-reply-form-v149" onSubmit={submitReply}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={600} placeholder={`Répondre à ${author.pseudo || 'ce membre'}…`} />
            <button type="submit" className="small-btn" disabled={!reply.trim()}>Répondre</button>
          </form>
        ) : null}
        {Array.isArray(comment.replies) && comment.replies.length ? (
          <div className="comment-replies-v149">
            {comment.replies.map((child) => <CommentItem key={child.id} mediaId={mediaId} comment={child} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} level={level + 1} />)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function LuxeProfileCard({ profile, index, onFollow, onMessage }) {
  const locked = (profile.albums || []).some((album) => album.visibility === 'private' && !album.unlocked);
  return (
    <article className="luxe-profile-card" onClick={() => onMessage ? onMessage(profile.id) : onFollow(profile.id)}>
      <div className="luxe-profile-photo" style={{ backgroundImage: `url(${profile.profilePhotoUrl || ''})` }}>
        {index === 0 ? <span className="new-badge">Nouveau</span> : null}
        {profile.online ? <span className="online-badge">En ligne</span> : null}
        {locked ? <span className="lock-badge">🔒</span> : null}
      </div>
      <div className="luxe-profile-info"><strong>{profile.pseudo}</strong><small>{memberAgeLabel(profile)} • {distanceLabel(profile)} <i className={profile.online ? 'online-dot' : ''} /></small></div>
    </article>
  );
}


function SearchSwitch({ checked, onChange, label, icon = '' }) {
  return (
    <button type="button" className={cx('search-switch-v143', checked && 'active')} onClick={() => onChange?.(!checked)} aria-pressed={Boolean(checked)}>
      <span className="switch-track-v143"><i /></span>
      {icon ? <em>{icon}</em> : null}
      <strong>{label}</strong>
    </button>
  );
}


function SearchNestedPresetGroup({ group, presets, selected = [], onToggle }) {
  const [open, setOpen] = useState(true);
  const mainPreset = presets.find((preset) => preset.id === group.main);
  if (!mainPreset) return null;
  const childPresets = (group.children || []).map((id) => presets.find((preset) => preset.id === id)).filter(Boolean);
  const selectedSet = new Set(Array.isArray(selected) ? selected : []);
  const parentActive = selectedSet.has(mainPreset.id);
  const hasActiveChild = childPresets.some((preset) => selectedSet.has(preset.id));
  return (
    <div className={cx('nested-search-group-v144', (parentActive || hasActiveChild) && 'active')}>
      <div className="nested-search-parent-v144">
        <label>
          <input type="checkbox" checked={parentActive} onChange={() => onToggle?.(mainPreset.id)} />
          <span className="nested-search-icon-v144">{group.icon}</span>
          <strong>{group.title || mainPreset.label}</strong>
        </label>
        {childPresets.length ? <button type="button" className={cx(open && 'open')} onClick={() => setOpen((current) => !current)} aria-label={open ? 'Masquer les sous-options' : 'Afficher les sous-options'}>⌄</button> : null}
      </div>
      {open && childPresets.length ? (
        <div className="nested-search-children-v144">
          {childPresets.map((preset) => (
            <label key={preset.id} className={cx(selectedSet.has(preset.id) && 'active')}>
              <input type="checkbox" checked={selectedSet.has(preset.id)} onChange={() => onToggle?.(preset.id)} />
              <span>{preset.menuLabel || preset.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchPage({ profiles, me, social = {}, grantedByMe = [], options, videos = [], onView, onShare, onRefresh, onLike, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, showToast, onFollow, onHeart, onPass, onMessage, onOpenProfile, onOpenPrivateAlbum, onExchangePrivateAlbums, onRequestAlbum, onReport }) {
  const [filters, setFilters] = useState(() => ({ ...defaultFilters }));
  const [view, setView] = useState('grid');
  const [searchTab, setSearchTab] = useState('profils');
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(SEARCH_SAVED_KEY) || '[]'); } catch { return []; }
  });
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [panel, setPanel] = useState('discover');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const visible = useMemo(() => profiles.filter((p) => profileMatches(p, filters)).sort((a, b) => (a.passedByMe - b.passedByMe) || profileCompatibilityScore(b, me) - profileCompatibilityScore(a, me) || distanceValue(a) - distanceValue(b)), [profiles, filters, me]);
  const onlineCount = visible.filter((p) => p.online).length;
  const detailOptions = options.details || fallbackOptions.details;
  const activeFilterLabels = [
    filters.category !== DETAIL_FILTER_ALL ? filters.category : '',
    filters.nearProfile ? 'Proche de mon profil' : '',
    filters.freeTonight ? 'Libre ce soir' : '',
    filters.q ? `Recherche "${filters.q}"` : '',
    Number(filters.maxKm || SEARCH_RADIUS_MAX_KM) < SEARCH_RADIUS_MAX_KM ? `Rayon ${radiusLabel(filters.maxKm)}` : '',
    filters.minAge !== defaultFilters.minAge || filters.maxAge !== defaultFilters.maxAge ? `Âge ${filters.minAge}-${filters.maxAge}` : '',
    filters.hairColor !== DETAIL_FILTER_ALL ? `Cheveux ${filters.hairColor}` : '',
    filters.eyeColor !== DETAIL_FILTER_ALL ? `Yeux ${filters.eyeColor}` : '',
    filters.origin !== DETAIL_FILTER_ALL ? `Origine ${filters.origin}` : '',
    filters.orientation !== DETAIL_FILTER_ALL ? `Orientation ${filters.orientation}` : '',
    filters.bodyType !== DETAIL_FILTER_ALL ? `Corpulence ${filters.bodyType}` : '',
    filters.hairStyle !== DETAIL_FILTER_ALL ? `Pilosité ${filters.hairStyle}` : '',
    filters.city ? `Ville ${filters.city}` : '',
    filters.region !== DETAIL_FILTER_ALL ? `Région ${filters.region}` : '',
    ...(Array.isArray(filters.meetingTypes) ? filters.meetingTypes : []),
    ...(Array.isArray(filters.fetishes) ? filters.fetishes : []),
    ...(Array.isArray(filters.profileTypes) && filters.profileTypes.length ? filters.profileTypes.map((id) => profileTypeLabelById(id)) : []),
    ...(Array.isArray(filters.seekTypes) && filters.seekTypes.length ? filters.seekTypes.map((id) => `Recherche ${wantedTypeLabelById(id).toLowerCase()}`) : []),
    filters.minHeight ? `Taille ≥ ${filters.minHeight} cm` : '',
    filters.maxHeight ? `Taille ≤ ${filters.maxHeight} cm` : '',
    filters.minWeight ? `Poids ≥ ${filters.minWeight} kg` : '',
    filters.maxWeight ? `Poids ≤ ${filters.maxWeight} kg` : '',
    filters.online ? 'En ligne' : '',
    filters.verified ? 'Vérifiés' : '',
    filters.photoOnly ? 'Photo personnelle' : '',
  ].filter(Boolean);
  const incomingLikes = social.incomingLikes || [];
  const matches = social.matches || [];
  const recentViews = social.recentViews || [];
  const grantsByViewerId = useMemo(() => new Map((grantedByMe || []).map((grant) => [grant.viewer?.id || grant.viewerId, grant])), [grantedByMe]);
  function grantFor(profile) { return grantsByViewerId.get(profile?.id); }
  function setFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
  function toggleProfileType(typeId) {
    setFilters((current) => {
      const currentTypes = Array.isArray(current.profileTypes) ? current.profileTypes : [];
      const nextTypes = currentTypes.includes(typeId) ? currentTypes.filter((item) => item !== typeId) : [...currentTypes, typeId];
      return { ...current, profileTypes: nextTypes };
    });
  }
  function toggleSeekType(typeId) {
    setFilters((current) => {
      const currentTypes = Array.isArray(current.seekTypes) ? current.seekTypes : [];
      const nextTypes = currentTypes.includes(typeId) ? currentTypes.filter((item) => item !== typeId) : [...currentTypes, typeId];
      return { ...current, seekTypes: nextTypes };
    });
  }
  function persistSavedSearches(items) {
    const next = items.slice(0, 8);
    setSavedSearches(next);
    try { window.localStorage.setItem(SEARCH_SAVED_KEY, JSON.stringify(next)); } catch {}
  }
  function saveCurrentSearch() {
    const name = window.prompt?.('Nom de la recherche mémorisée ?', filters.q ? `Recherche ${filters.q}` : 'Ma recherche') || '';
    if (!name.trim()) return;
    const item = { id: `search_${Date.now()}`, name: name.trim(), filters: { ...filters }, createdAt: new Date().toISOString() };
    persistSavedSearches([item, ...savedSearches.filter((saved) => saved.name !== item.name)]);
  }
  function applySavedSearch(item) { setFilters({ ...defaultFilters, ...(item.filters || {}) }); }
  function deleteSavedSearch(id) { persistSavedSearches(savedSearches.filter((item) => item.id !== id)); }
  function resetFilters() { setFilters({ ...defaultFilters, profileTypes: [], seekTypes: [] }); }
  async function openProfile(profile) {
    setSelectedProfile(profile);
    setLoadingProfile(true);
    try {
      const result = await apiFetch(`/profiles/${profile.id}`);
      setSelectedProfile(result.profile || profile);
    } catch {
      setSelectedProfile(profile);
    } finally {
      setLoadingProfile(false);
    }
  }
  async function act(handler, profile) {
    const result = await handler(profile.id);
    if (result?.profile) setSelectedProfile((current) => current?.id === profile.id ? result.profile : current);
  }
  return (
    <section className="page social-page profile-discovery-page v22-discovery-page search-redesign-v170">
      <div className="search-topbar-v170">
        <label className="search-topbar-input-v170">
          <span className="search-topbar-ico">⌕</span>
          <input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Pseudo" aria-label="Recherche par pseudo" />
          {filters.q ? <button type="button" className="search-topbar-clear" onClick={() => setFilter('q', '')} aria-label="Effacer">×</button> : null}
          <button type="button" className={cx('search-topbar-chevron', showFilters && 'open')} onClick={() => setShowFilters((v) => !v)} aria-label="Filtres" aria-expanded={showFilters} title="Filtres">⌄</button>
        </label>
        <div className="search-topbar-view" aria-label="Mode d’affichage">
          <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Affichage cartes">▦</button>
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="Affichage liste">☷</button>
        </div>
      </div>
      <div className="search-maintabs-v170" role="tablist" aria-label="Profils ou vidéos">
        <button type="button" role="tab" aria-selected={searchTab === 'profils'} className={searchTab === 'profils' ? 'active' : ''} onClick={() => setSearchTab('profils')}>Profils</button>
        <button type="button" role="tab" aria-selected={searchTab === 'videos'} className={searchTab === 'videos' ? 'active' : ''} onClick={() => setSearchTab('videos')}>Vidéos</button>
      </div>
      {showFilters ? (
        <div className="search-filter-overlay-v170" onClick={() => setShowFilters(false)}>
        <aside className="glass search-panel social-filter-panel advanced-search-panel-v143 search-filter-float-v170" onClick={(e) => e.stopPropagation()}>
          <div className="search-float-head-v170"><strong>Filtres</strong><button type="button" onClick={() => setShowFilters(false)} aria-label="Fermer les filtres">×</button></div>
          <div className="advanced-search-head-v143">
            <div>
              <p className="eyebrow">Recherche</p>
              <h2>Filtres utilisateurs</h2>
            </div>
            <div className="search-view-toggle-v143" aria-label="Mode d’affichage">
              <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Affichage cartes">▦</button>
              <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="Affichage liste">☷</button>
            </div>
          </div>
          <div className="search-filter-summary-v72"><strong>{visible.length}</strong><span>profil{visible.length > 1 ? 's' : ''} trouvé{visible.length > 1 ? 's' : ''}</span></div>
          <label className="search-main-input-v143">
            <span>⌕</span>
            <input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Recherche" />
            {filters.q ? <button type="button" onClick={() => setFilter('q', '')}>×</button> : null}
          </label>
          <div className="search-switch-list-v143">
            <SearchSwitch checked={Boolean(filters.nearProfile)} onChange={(checked) => setFilter('nearProfile', checked)} label="Proche de mon profil" />
            <SearchSwitch checked={Boolean(filters.photoOnly)} onChange={(checked) => setFilter('photoOnly', checked)} label="Avec photos" icon="▧" />
            <SearchSwitch checked={Boolean(filters.freeTonight)} onChange={(checked) => setFilter('freeTonight', checked)} label="Libre ce soir" />
          </div>
          <Field label="Pseudo ?" value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Pseudo, ville, envie…" compact />

          <details className="search-accordion-v143" open>
            <summary>Principaux critères</summary>
            <div className="criteria-group-v143">
              <div className="criteria-title-v143">
                <h3>Je recherche</h3>
                {Array.isArray(filters.profileTypes) && filters.profileTypes.length ? <button type="button" onClick={() => setFilter('profileTypes', [])}>Effacer</button> : null}
              </div>
              <div className="profile-type-checks-v140 compact-search-checks-v143 nested-search-list-v144">
                {SEARCH_PROFILE_GROUPS.map((group) => (
                  <SearchNestedPresetGroup key={group.id} group={group} presets={SEARCH_PROFILE_PRESETS} selected={filters.profileTypes} onToggle={toggleProfileType} />
                ))}
              </div>
            </div>
            <div className="criteria-group-v143">
              <div className="criteria-title-v143">
                <h3>Qui recherchent</h3>
                {Array.isArray(filters.seekTypes) && filters.seekTypes.length ? <button type="button" onClick={() => setFilter('seekTypes', [])}>Effacer</button> : null}
              </div>
              <div className="profile-type-checks-v140 compact-search-checks-v143 nested-search-list-v144">
                {SEARCH_WANTED_GROUPS.map((group) => (
                  <SearchNestedPresetGroup key={group.id} group={group} presets={SEARCH_WANTED_PRESETS} selected={filters.seekTypes} onToggle={toggleSeekType} />
                ))}
              </div>
            </div>
          </details>

          <details className="search-accordion-v143">
            <summary>Pratiques &amp; envies</summary>
            <div className="criteria-group-v143">
              <div className="criteria-title-v143">
                <h3>Types de rencontres</h3>
                {Array.isArray(filters.meetingTypes) && filters.meetingTypes.length ? <button type="button" onClick={() => setFilter('meetingTypes', [])}>Effacer</button> : null}
              </div>
              <OptionChips options={detailOptions.meetingTypes || []} selected={filters.meetingTypes} onToggle={(opt) => setFilter('meetingTypes', toggleInList(filters.meetingTypes, opt))} />
            </div>
            <div className="criteria-group-v143">
              <div className="criteria-title-v143">
                <h3>Fétiches &amp; spécificités</h3>
                {Array.isArray(filters.fetishes) && filters.fetishes.length ? <button type="button" onClick={() => setFilter('fetishes', [])}>Effacer</button> : null}
              </div>
              <OptionChips options={detailOptions.fetishes || []} selected={filters.fetishes} onToggle={(opt) => setFilter('fetishes', toggleInList(filters.fetishes, opt))} />
            </div>
          </details>

          <details className="search-accordion-v143" open>
            <summary>Localisation</summary>
            <label className="luxe-slider"><span>Rayon <b>{radiusLabel(filters.maxKm)}</b></span><input type="range" min="10" max={SEARCH_RADIUS_MAX_KM} step="10" value={filters.maxKm || SEARCH_RADIUS_MAX_KM} onChange={(e) => setFilter('maxKm', e.target.value)} /><small><em>10 km</em><em>{SEARCH_RADIUS_MAX_KM} km</em></small></label>
            <div className="search-advanced-grid-v72 search-physical-grid-v143">
              <Field label="Ville" value={filters.city} onChange={(v) => setFilter('city', v)} placeholder="Paris, Lyon…" compact />
              <SelectField label="Région" value={filters.region} options={['Tous', ...SEARCH_REGIONS]} onChange={(v) => setFilter('region', v)} compact />
            </div>
          </details>

          <details className="search-accordion-v143">
            <summary>Physique</summary>
            <div className="search-range-grid-v72">
              <Field label="Âge min" type="number" value={filters.minAge} onChange={(v) => setFilter('minAge', v)} compact />
              <Field label="Âge max" type="number" value={filters.maxAge} onChange={(v) => setFilter('maxAge', v)} compact />
            </div>
            <div className="search-advanced-grid-v72 search-physical-grid-v143">
              <SelectField label="Cheveux" value={filters.hairColor} options={['Tous', ...(detailOptions.hairColors || [])]} onChange={(v) => setFilter('hairColor', v)} compact />
              <SelectField label="Yeux" value={filters.eyeColor} options={['Tous', ...(detailOptions.eyeColors || [])]} onChange={(v) => setFilter('eyeColor', v)} compact />
              <SelectField label="Origine" value={filters.origin} options={['Tous', ...(detailOptions.origins || [])]} onChange={(v) => setFilter('origin', v)} compact />
              <SelectField label="Orientation" value={filters.orientation} options={['Tous', ...(detailOptions.sexualOrientations || fallbackOptions.details.sexualOrientations || [])]} onChange={(v) => setFilter('orientation', v)} compact />
              <SelectField label="Silhouette" value={filters.bodyType} options={['Tous', ...(detailOptions.bodyTypes || fallbackOptions.details.bodyTypes || [])]} onChange={(v) => setFilter('bodyType', v)} compact />
              <SelectField label="Pilosité" value={filters.hairStyle} options={['Tous', ...(detailOptions.hairStyles || [])]} onChange={(v) => setFilter('hairStyle', v)} compact />
            </div>
            <div className="search-range-grid-v72">
              <Field label="Taille min" type="number" value={filters.minHeight} onChange={(v) => setFilter('minHeight', v)} placeholder="cm" compact />
              <Field label="Taille max" type="number" value={filters.maxHeight} onChange={(v) => setFilter('maxHeight', v)} placeholder="cm" compact />
            </div>
            <div className="search-range-grid-v72">
              <Field label="Poids min" type="number" value={filters.minWeight} onChange={(v) => setFilter('minWeight', v)} placeholder="kg" compact />
              <Field label="Poids max" type="number" value={filters.maxWeight} onChange={(v) => setFilter('maxWeight', v)} placeholder="kg" compact />
            </div>
          </details>

          <details className="search-accordion-v143">
            <summary>Autres critères</summary>
            <div className="checks-stack search-other-checks-v143">
              <label><input type="checkbox" checked={filters.online} onChange={(e) => setFilter('online', e.target.checked)} /> En ligne maintenant</label>
              <label><input type="checkbox" checked={filters.verified} onChange={(e) => setFilter('verified', e.target.checked)} /> Profils vérifiés</label>
              <label><input type="checkbox" checked={filters.photoOnly} onChange={(e) => setFilter('photoOnly', e.target.checked)} /> Avec photos</label>
              <label><input type="checkbox" checked={filters.freeTonight} onChange={(e) => setFilter('freeTonight', e.target.checked)} /> Libre ce soir</label>
            </div>
          </details>

          <details className="search-accordion-v143">
            <summary>Recherches mémorisées</summary>
            <div className="saved-searches-v143">
              <button type="button" className="secondary-btn" onClick={saveCurrentSearch}>Sauvegarder cette recherche</button>
              {savedSearches.map((item) => (
                <div className="saved-search-row-v143" key={item.id}>
                  <button type="button" onClick={() => applySavedSearch(item)}>{item.name}</button>
                  <button type="button" onClick={() => deleteSavedSearch(item.id)} aria-label="Supprimer la recherche">×</button>
                </div>
              ))}
              {!savedSearches.length ? <small>Aucune recherche mémorisée.</small> : null}
            </div>
          </details>

          <button type="button" className="reset-link" onClick={resetFilters}>Réinitialiser{activeFilterLabels.length ? ` (${activeFilterLabels.length})` : ''}</button>
          <SocialInboxMini title="Ils vous ont liké" items={incomingLikes} empty="Aucun coup de cœur reçu." onOpen={(item) => item.profile && openProfile(item.profile)} />
          <SocialInboxMini title="Visiteurs récents" items={recentViews} empty="Aucune visite pour le moment." onOpen={(item) => item.profile && openProfile(item.profile)} />
        </aside>
        </div>
      ) : null}
      {searchTab === 'videos' ? (
        <ToktakFeed videos={videos} me={me} onLike={onLike} onView={onView} onShare={onShare} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} onOpenProfile={onOpenProfile} onRefresh={onRefresh} showToast={showToast} />
      ) : (
        <main className="social-results search-results-v170">
          <div className="panel-title-row social-title-row">
            <div><p className="eyebrow">{visible.length} résultat(s)</p><h2>Profils compatibles</h2></div>
            <div className="feed-tabs compact-tabs">
              <button type="button" className={panel === 'discover' ? 'active' : ''} onClick={() => setPanel('discover')}>Découverte</button>
              <button type="button" className={panel === 'likes' ? 'active' : ''} onClick={() => setPanel('likes')}>Qui m’a liké</button>
              <button type="button" className={panel === 'matches' ? 'active' : ''} onClick={() => setPanel('matches')}>Matchs</button>
              <button type="button" className={panel === 'views' ? 'active' : ''} onClick={() => setPanel('views')}>Visiteurs</button>
              <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>Cartes</button>
              <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Liste</button>
            </div>
          </div>
          {activeFilterLabels.length ? (
            <div className="active-filter-row-v72">
              {activeFilterLabels.map((label) => <span key={label}>{label}</span>)}
              <button type="button" onClick={resetFilters}>Tout effacer</button>
            </div>
          ) : null}

          {panel === 'discover' ? (
            <div className={cx('profile-social-grid', view === 'list' && 'list-view')}>
              {visible.map((profile) => <ProfileResult key={profile.id} profile={profile} me={me} albumGrant={grantFor(profile)} onFollow={onFollow} onMessage={() => onMessage(profile.id)} onCourier={() => onMessage(profile.id)} onOpenPrivateAlbum={(durationSeconds) => onOpenPrivateAlbum?.(profile.id, durationSeconds)} onExchangePrivateAlbums={(durationSeconds) => onExchangePrivateAlbums?.(profile.id, durationSeconds)} onRequestAlbum={onRequestAlbum} onOpen={() => openProfile(profile)} />)}
              {!visible.length && (
                <div className="search-empty-actions-v72">
                  <ActionEmptyState
                    icon="🔎"
                    title="Aucun profil ne correspond à ces filtres."
                    subtitle="Essayez un rayon plus large, retirez les critères trop précis ou affichez les profils sans photo."
                    primaryLabel="Élargir la recherche"
                    onPrimary={resetFilters}
                    tips={["Rayon conseillé au lancement : 500 km.", "Les nouveaux membres apparaîtront automatiquement ici."]}
                  />
                </div>
              )}
            </div>
          ) : (
            <SocialPeopleList
              title={panel === 'likes' ? 'Profils qui vous ont envoyé un coup de cœur' : panel === 'matches' ? 'Vos coups de cœur réciproques' : 'Profils qui ont consulté votre fiche'}
              items={panel === 'likes' ? incomingLikes : panel === 'matches' ? matches : recentViews}
              onOpen={(profile) => openProfile(profile)}
              onHeart={(profile) => act(onHeart, profile)}
              onPass={(profile) => act(onPass, profile)}
              onMessage={(profile) => onMessage(profile.id)}
              onFollow={(profile) => onFollow(profile.id)}
              grantForProfile={grantFor}
              onOpenPrivateAlbum={(profile, durationSeconds) => onOpenPrivateAlbum?.(profile.id, durationSeconds)}
            />
          )}
        </main>
      )}
      {selectedProfile ? <SocialProfileModal profile={selectedProfile} me={me} albumGrant={grantFor(selectedProfile)} loading={loadingProfile} onClose={() => setSelectedProfile(null)} onFollow={onFollow} onHeart={() => act(onHeart, selectedProfile)} onPass={() => act(onPass, selectedProfile)} onMessage={() => onMessage(selectedProfile.id)} onOpenPrivateAlbum={(durationSeconds) => onOpenPrivateAlbum?.(selectedProfile.id, durationSeconds)} onExchangePrivateAlbums={(durationSeconds) => onExchangePrivateAlbums?.(selectedProfile.id, durationSeconds)} onRequestAlbum={onRequestAlbum} onReport={onReport} mode="search" /> : null}
    </section>
  );
}

function SocialInboxMini({ title, items = [], empty, onOpen }) {
  return (
    <div className="v22-inbox-mini">
      <h3>{title}</h3>
      {items.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => onOpen(item)}><Avatar profile={item.profile} /><span><strong>{item.profile?.pseudo}</strong><small>{item.profile?.category || item.profile?.type} • {item.profile?.city}</small></span></button>)}
      {!items.length ? <p>{empty}</p> : null}
    </div>
  );
}

function SocialPeopleList({ title, items = [], onOpen, onMessage, onFollow, grantForProfile, onOpenPrivateAlbum }) {
  return (
    <article className="glass v22-people-list">
      <h3>{title}</h3>
      <div className="v22-people-grid">
        {items.map((item) => item.profile ? (
          <div className="v22-person-row search-person-row-v66" key={item.id}>
            <button type="button" onClick={() => onOpen(item.profile)}><Avatar profile={item.profile} /><span><strong>{item.profile.pseudo}</strong><small>{item.profile.city} • {item.profile.category || item.profile.type}</small></span></button>
            <ProfileSearchActions profile={item.profile} albumGrant={grantForProfile?.(item.profile)} onFollow={() => onFollow?.(item.profile)} onMessage={() => onMessage?.(item.profile)} onCourier={() => onMessage?.(item.profile)} onOpenPrivateAlbum={(durationSeconds) => onOpenPrivateAlbum?.(item.profile, durationSeconds)} compact />
          </div>
        ) : null)}
        {!items.length && <EmptyState title="Rien à afficher pour le moment." />}
      </div>
    </article>
  );
}

function ProfileDecisionButtons({ profile, onHeart, onMessage, onPass, compact = false }) {
  return (
    <div className={cx('profile-decision-row', compact && 'compact')}>
      <button type="button" className={cx('decision-btn heart', profile.likedByMe && 'active')} disabled={!profile.heartAllowed} onClick={onHeart}>♡ <span>Liker</span></button>
      <button type="button" className="decision-btn message" onClick={onMessage}>✉ <span>Message</span></button>
      <button type="button" className={cx('decision-btn pass', profile.passedByMe && 'active')} onClick={onPass}>× <span>Non</span></button>
    </div>
  );
}

function PrivateAlbumAccessButton({ profile, albumGrant, onOpenPrivateAlbum, compact = false }) {
  const [open, setOpen] = useState(false);
  const isOpen = Boolean(albumGrant?.status === 'granted' && (!albumGrant.expiresAt || new Date(albumGrant.expiresAt).getTime() > Date.now()));
  async function choose(durationSeconds) {
    setOpen(false);
    await onOpenPrivateAlbum?.(durationSeconds);
  }
  const accessLabel = isOpen
    ? albumGrant.expiresAt ? `Ouvert jusqu’au ${formatDate(albumGrant.expiresAt)}` : 'Ouvert sans limite'
    : 'Ouvrir mon album privé';
  return (
    <div className={cx('profile-lock-menu-v66 private-album-access-v67', compact && 'compact')}>
      <button type="button" className={cx('profile-action-lock-v66', isOpen && 'active')} onClick={() => setOpen((current) => !current)} aria-expanded={open} title={accessLabel}>
        <span>{isOpen ? '🔓' : '🔒'}</span><em>{compact ? 'Album' : 'Album privé'}</em>
      </button>
      {open ? (
        <div className="profile-lock-popover-v66 private-album-popover-v67">
          <p>{isOpen ? 'Modifier la durée d’ouverture' : `Ouvrir votre album privé à ${profile?.pseudo || 'ce profil'} pendant`}</p>
          {PROFILE_LOCK_DURATIONS.map((duration) => (
            <button type="button" key={duration.label} onClick={() => choose(duration.seconds)}>{duration.label}</button>
          ))}
          {isOpen ? <small>{accessLabel}</small> : null}
        </div>
      ) : null}
    </div>
  );
}

function PrivateAlbumExchangeButton({ profile, onExchangePrivateAlbums, compact = false }) {
  const [open, setOpen] = useState(false);
  if (!onExchangePrivateAlbums) return null;
  async function choose(durationSeconds) {
    setOpen(false);
    await onExchangePrivateAlbums?.(durationSeconds);
  }
  return (
    <div className={cx('profile-lock-menu-v66 private-album-access-v67 private-album-exchange-v138', compact && 'compact')}>
      <button type="button" className="profile-action-lock-v66 exchange" onClick={() => setOpen((current) => !current)} aria-expanded={open} title="Proposer un échange d’albums privés">
        <span>⇄</span><em>{compact ? 'Échange' : 'Échanger albums'}</em>
      </button>
      {open ? (
        <div className="profile-lock-popover-v66 private-album-popover-v67">
          <p>Ouvrir votre album privé à {profile?.pseudo || 'ce profil'} et demander l’accès au sien pendant</p>
          {PROFILE_LOCK_DURATIONS.map((duration) => (
            <button type="button" key={duration.label} onClick={() => choose(duration.seconds)}>{duration.label}</button>
          ))}
          <small>L’autre personne garde le choix d’accepter ou refuser l’échange inverse.</small>
        </div>
      ) : null}
    </div>
  );
}

function albumAccessStatusLabel(album) {
  const access = album?.access || {};
  if (album?.visibility !== 'private') return 'Album public';
  if (album?.unlocked || access.status === 'owner') return 'Accès ouvert';
  if (access.status === 'requested') return access.exchangeRequested ? 'Échange demandé' : 'Demande envoyée';
  if (access.status === 'declined') return 'Refusé pour le moment';
  if (access.status === 'expired') return 'Accès expiré';
  if (access.status === 'granted') return access.expiresAt ? `Ouvert jusqu’au ${formatDate(access.expiresAt)}` : 'Ouvert sans limite';
  return 'Verrouillé';
}

function ProfileSearchActions({ profile, albumGrant, onFollow, onMessage, onCourier, onOpenPrivateAlbum, compact = false }) {
  return (
    <div className={cx('profile-search-actions-v66', compact && 'compact')}>
      <button type="button" className={cx('search-action-v66 subscribe', profile.followedByMe && 'active')} onClick={onFollow}><Icon name="follow" /> <span>{profile.followedByMe ? 'Suivi' : "Suivre"}</span></button>
      <button type="button" className="search-action-v66 chat" onClick={onMessage}><Icon name="messages" /> <span>Discuter</span></button>
      <button type="button" className="search-action-v66 mail" onClick={onCourier}><Icon name="send" /> <span>Message</span></button>
      <PrivateAlbumAccessButton profile={profile} albumGrant={albumGrant} onOpenPrivateAlbum={onOpenPrivateAlbum} compact={compact} />
    </div>
  );
}

function ProfileResult({ profile, me, albumGrant, onFollow, onMessage, onCourier, onOpenPrivateAlbum, onExchangePrivateAlbums, onRequestAlbum, onOpen }) {
  const albums = profile.albums || [];
  const privateAlbum = albums.find((album) => album.visibility === 'private');
  const publicAlbum = albums.find((album) => album.visibility === 'public');
  const mediaCount = albums.reduce((sum, album) => sum + ((album.items || []).length), 0);
  const compatibility = profileCompatibilityScore(profile, me);
  const reasons = profileCompatibilityReasons(profile, me);
  return (
    <article className={cx('glass social-profile-card v22-profile-card search-profile-card-v66', profile.blockedByMe && 'is-blocked')}>
      <button type="button" className="profile-cover-button" onClick={onOpen} aria-label={`Ouvrir le profil de ${profile.pseudo}`}>
        <div className="social-profile-cover search-profile-cover-v66" style={{ backgroundImage: `url(${profile.profilePhotoUrl || ''})` }}>
          {profile.online ? <span className="online-badge">En ligne</span> : null}
          {profile.verified ? <span className="verified-badge">✓ Vérifié</span> : null}
          {profile.mutualHeart ? <span className="match-badge">Match</span> : profile.likedMe ? <span className="match-badge soft">Vous a liké</span> : null}
          {privateAlbum ? <span className="lock-badge">🔒 album privé</span> : null}
          {compatibility ? <span className="compat-cover-badge-v127">{compatibility}% compatible</span> : null}
        </div>
      </button>
      <div className="social-profile-body">
        <div className="social-profile-headline">
          <Avatar profile={profile} />
          <div>
            <p className="eyebrow">{distanceLabel(profile)} • {profile.category || profile.type}</p>
            <button type="button" className="profile-name-button" onClick={onOpen}><h3>{profile.pseudo}</h3><em>Voir le profil</em></button>
            <small>{memberAgeLabel(profile)} • {profile.city}</small>
            {cityMapUrl(profile) ? <a className="profile-map-link" href={cityMapUrl(profile)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Voir le plan</a> : null}
          </div>
        </div>
        <p className="profile-hook">{profile.headline || profile.bio}</p>
        <ProfileBadges profile={profile} />
        <div className="compat-reasons-v127">{reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
        <div className="social-chip-row">
          {(profile.interests || []).slice(0, 3).map((item) => <span key={item}>{item}</span>)}
          {publicAlbum ? <span>{(publicAlbum.items || []).length} médias publics</span> : null}
          {privateAlbum ? <span>Privé sur demande</span> : null}
        </div>
        <div className="profile-mini-stats">
          <ProfileStat value={profile.followerCount || 0} label="abonnés" />
          <ProfileStat value={mediaCount} label="médias" />
          <ProfileStat value={(profile.albums || []).length} label="albums" />
        </div>
        <MembersPreview profile={profile} />
        <ProfileSearchActions profile={profile} albumGrant={albumGrant} onFollow={() => onFollow(profile.id)} onMessage={onMessage} onCourier={onCourier} onOpenPrivateAlbum={onOpenPrivateAlbum} />
        <div className="profile-actions-row social-actions-row secondary-profile-actions search-secondary-v66">
          <button type="button" className="landing-btn-outline small" onClick={onOpen}>Voir profil</button>
          {privateAlbum ? <button type="button" className="small-btn" onClick={() => onRequestAlbum(profile.id, privateAlbum.id)}>Demander album</button> : null}
        </div>
      </div>
    </article>
  );
}

function formatShortDate(value) {
  if (!value) return 'Non renseigné';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return 'Non renseigné';
  }
}

function mediaDisplayUrl(media, profile) {
  return media?.url || media?.dataUrl || media?.src || profile?.profilePhotoUrl || defaultProfilePhoto(profile?.pseudo || 'Profil');
}

function profileMemberDetailRows(profile) {
  const members = Array.isArray(profile?.members) ? profile.members : [];
  if (!members.length) return [];
  return members.map((member, index) => ({
    id: `${profile?.id || 'profile'}-member-${index}`,
    title: memberRoleLabel(profile?.category || profile?.type, index),
    rows: [
      ['Âge', member.age ? `${member.age} ans` : 'Non renseigné'],
      ['Genre', member.gender || 'Non renseigné'],
      ['Orientation', member.sexualOrientation || member.orientation || 'Non renseignée'],
      ['Silhouette', member.bodyType || member.details?.bodyType || 'Non renseignée'],
      ['Taille', member.heightCm || member.details?.heightCm ? `${member.heightCm || member.details?.heightCm} cm` : 'Non renseignée'],
      ['Poids', member.weightKg || member.details?.weightKg ? `${member.weightKg || member.details?.weightKg} kg` : 'Non renseigné'],
      ['Yeux', member.eyeColor || member.details?.eyeColor || 'Non renseigné'],
      ['Cheveux', member.hairColor || member.details?.hairColor || 'Non renseigné'],
      ['Origine', member.origin || member.details?.origin || 'Non renseignée'],
    ],
  }));
}

function InfoPair({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return <span className="profile-info-pair-v116"><small>{label}</small><strong>{value}</strong></span>;
}

function SocialProfileModal({ profile, me, albumGrant, loading, onClose, onFollow, onHeart, onPass, onMessage, onBlock, onReport, onOpenPrivateAlbum, onExchangePrivateAlbums, onRequestAlbum, onFavorite, onIcebreaker, onDiscussTonight, mode = 'social' }) {
  const albums = profile.albums || [];
  const privateAlbums = albums.filter((album) => album.visibility === 'private');
  const publicAlbums = albums.filter((album) => album.visibility !== 'private');
  const mediaCount = albums.reduce((sum, album) => sum + ((album.items || []).length), 0);
  const publicMedia = publicAlbums.flatMap((album) => (album.items || []).map((media) => ({ album, media })));
  const allMedia = albums.flatMap((album) => (album.items || []).map((media) => ({ album, media, locked: album.visibility === 'private' && !album.unlocked })));
  const memberRows = profileMemberDetailRows(profile);
  const isOnline = Boolean(profile.online);
  const liked = Boolean(profile.likedByMe || profile.heartedByMe);
  const [activePanel, setActivePanel] = useState('publications');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bio = profile.bio || profile.headline || 'Bio non renseignée.';
  const shortBio = bio.length > 145 && !bioExpanded ? `${bio.slice(0, 145).trim()}…` : bio;
  const ageLine = profile.ageDisplay || memberAgeLabel(profile) || (profile.age ? `${profile.age} ans` : 'Âge non renseigné');
  const profileType = profile.category || profile.type || 'Profil';
  const placeLine = [profile.city, distanceLabel(profile)].filter(Boolean).join(' · ');
  const compatibility = profileCompatibilityScore(profile, me);
  const compatibilityReasons = profileCompatibilityReasons(profile, me);
  const completion = profileCompletionScore(profile);
  const preferenceChips = [
    ...(Array.isArray(profile.lookingFor) ? profile.lookingFor : []),
    ...(Array.isArray(profile.interests) ? profile.interests.slice(0, 3) : []),
  ].filter(Boolean).slice(0, 8);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setActivePanel('publications');
    setBioExpanded(false);
    setMenuOpen(false);
  }, [profile.id]);

  const tabs = [
    { id: 'publications', icon: 'grid', label: 'Photos', badge: publicMedia.length || '' },
    { id: 'profil', icon: 'profile', label: 'Profil(s)', badge: memberRows.length || '' },
    { id: 'photos', icon: 'albums', label: 'Albums', badge: publicAlbums.length || '' },
    { id: 'prives', icon: 'privacy', label: 'Albums privés', badge: privateAlbums.length || '' },
  ];

  return (
    <div className="profile-panel-backdrop-v97 profile-panel-backdrop-v116" role="dialog" aria-modal="true" onClick={onClose}>
      <article className="profile-panel-v97 profile-panel-v116 glass" onClick={(e) => e.stopPropagation()}>
        <header className="profile-mobile-topbar-v116">
          <button type="button" className="profile-topbar-back-v116" onClick={onClose} aria-label="Retour">‹</button>
          <button type="button" className="profile-topbar-title-v116" onClick={() => setActivePanel('profil')}>
            <strong>{profile.pseudo || 'Profil'}</strong>
            <small>{placeLine || profileType}</small>
          </button>
          <button type="button" className={cx('profile-topbar-follow-v116', profile.followedByMe && 'active')} onClick={() => onFollow?.(profile.id)}>{profile.followedByMe ? 'Suivi' : 'Suivre'}</button>
          <button type="button" className="profile-topbar-menu-v116" onClick={() => setMenuOpen((value) => !value)} aria-label="Options">⋮</button>
          {menuOpen ? (
            <div className="profile-menu-popover-v116">
              <button type="button" onClick={() => { setActivePanel('profil'); setMenuOpen(false); }}>Voir les détails</button>
              <button type="button" onClick={() => { onPass?.(); setMenuOpen(false); }}>Masquer ce profil</button>
              <button type="button" onClick={() => { onFavorite?.(); setMenuOpen(false); }}>Favori privé</button>
              <button type="button" onClick={() => { setMenuOpen(false); onReport?.(profile, 'profile_panel'); }}>Signaler</button>
              <button type="button" className="danger" onClick={async () => {
                setMenuOpen(false);
                const ok = await appConfirm(`Bloquer ${profile.pseudo || 'ce profil'} ? Cette personne ne pourra plus vous contacter.`, { title: 'Bloquer', danger: true, confirmLabel: 'Bloquer' });
                if (ok) onBlock?.();
              }}>Bloquer</button>
            </div>
          ) : null}
        </header>

        <div className="profile-panel-scroll-v97 profile-panel-scroll-v116">
          <section className="profile-hero-card-v116">
            <div className="profile-hero-media-v116" style={{ backgroundImage: `url(${profile.profilePhotoUrl || defaultProfilePhoto(profile.pseudo || 'Profil')})` }}>
              <div className="profile-hero-shade-v116" />
              {profile.verified ? <span className="profile-verified-pill-v116">✓ Vérifié</span> : null}
              {isOnline ? <span className="profile-online-pill-v116">● En ligne</span> : null}
              <CompatibilityPill profile={profile} me={me} />
            </div>
            <div className="profile-summary-card-v116">
              <Avatar profile={profile} large />
              <div className="profile-summary-main-v116">
                <div className="profile-summary-title-v116">
                  <h2>{profile.pseudo || 'Profil'}</h2>
                  <span>{profileType}</span>
                </div>
                <p>{[placeLine, ageLine].filter(Boolean).join(' · ')}</p>
                <ProfileBadges profile={profile} />
                <div className="compat-reasons-v127">{compatibilityReasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
                <p className="profile-summary-bio-v116">{shortBio}</p>
                {bio.length > 145 ? <button type="button" className="profile-readmore-v116" onClick={() => setBioExpanded((value) => !value)}>{bioExpanded ? 'Réduire' : 'Lire la suite'}</button> : null}
              </div>
            </div>
            <div className="profile-trust-strip-v127 profile-ig-stats-v187">
              <span><strong>{publicMedia.length}</strong><small>publications</small></span>
              <span><strong>{profile.followerCount || 0}</strong><small>abonnés</small></span>
              <span><strong>{profile.followingCount || 0}</strong><small>suivi(e)s</small></span>
            </div>
          </section>

          <nav className="profile-action-row-v116" aria-label="Actions du profil">
            <button type="button" className={cx('profile-big-action-v116 follow', profile.followedByMe && 'active')} onClick={() => onFollow?.(profile.id)}><b><Icon name="follow" /></b><span>{profile.followedByMe ? 'Suivi' : 'Suivre'}</span></button>
            <button type="button" className="profile-big-action-v116 message" onClick={onMessage}><b><Icon name="messages" /></b><span>Lui écrire</span></button>
            <button type="button" className={cx('profile-big-action-v116 heart', liked && 'active')} onClick={onHeart}><b><Icon name="heart" /></b><span>{liked ? 'Aimé' : 'Cœur'}</span></button>
          </nav>
          <div className="profile-light-actions-v149">
            <button type="button" onClick={onFavorite}>☆ Favori privé</button>
            <button type="button" onClick={() => onIcebreaker?.()}>💬 Brise-glace</button>
            <button type="button" onClick={onDiscussTonight}>🌙 Dispo ce soir</button>
          </div>

          {loading ? <p className="profile-panel-loading-v97">Chargement du profil complet…</p> : null}

          <nav className="profile-tabs-v116" aria-label="Sections du profil">
            {tabs.map((tab) => (
              <button type="button" key={tab.id} className={activePanel === tab.id ? 'active' : ''} onClick={() => setActivePanel(tab.id)}>
                <i><Icon name={tab.icon} /></i><span>{tab.label}</span>{tab.badge ? <em>{tab.badge}</em> : null}
              </button>
            ))}
          </nav>

          {activePanel === 'publications' ? (
            <section className="profile-section-v116 profile-photos-v116 profile-wall-v187">
              {allMedia.length ? (
                <div className="profile-photo-grid-v116 profile-wall-grid-v187">
                  {allMedia.slice(0, 18).map(({ album, media, locked }) => (
                    <div key={media.id} className={cx('profile-photo-tile-v116', locked && 'locked')} style={{ backgroundImage: `url(${locked ? profile.profilePhotoUrl || defaultProfilePhoto(profile.pseudo) : mediaDisplayUrl(media, profile)})` }}>
                      <span>{locked ? '🔒' : media.type === 'video' ? '▶' : ''}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="Aucune photo pour le moment." text="Les photos publiques de ce profil apparaîtront ici, façon mur de photos." />}
            </section>
          ) : null}

          {activePanel === 'profil' ? (
            <section className="profile-section-v116 profile-detail-v116">
              <div className="profile-section-title-v116"><div><p className="eyebrow">Profil</p><h3>Informations détaillées</h3></div></div>
              <div className="profile-info-grid-v116">
                <InfoPair label="Ville" value={profile.city || 'Non renseignée'} />
                <InfoPair label="Distance" value={distanceLabel(profile) || 'Approx.'} />
                <InfoPair label="Type" value={profileType} />
                <InfoPair label="Âge" value={ageLine} />
                <InfoPair label="Expérience" value={profile.details?.experienceLevel || 'Non renseignée'} />
                <InfoPair label="Statut" value={profile.details?.relationshipStatus || 'Non renseigné'} />
                <InfoPair label="Inscription" value={formatShortDate(profile.createdAt)} />
                <InfoPair label="Dernière connexion" value={profile.lastSeen || (isOnline ? 'En ligne' : 'Récemment')} />
              </div>
              <div className="profile-about-box-v116"><h4>À propos</h4><p>{bio}</p></div>
              {Array.isArray(profile.lookingFor) && profile.lookingFor.length ? <div className="profile-chip-block-v116"><h4>Recherche</h4><div>{profile.lookingFor.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
              {Array.isArray(profile.interests) && profile.interests.length ? <div className="profile-chip-block-v116"><h4>Centres d’intérêt</h4><div>{profile.interests.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
              {Array.isArray(profile.meetingTypes) && profile.meetingTypes.length ? <div className="profile-chip-block-v116"><h4>Types de rencontres</h4><div>{profile.meetingTypes.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
              {Array.isArray(profile.fetishes) && profile.fetishes.length ? <div className="profile-chip-block-v116"><h4>Fétiches &amp; spécificités</h4><div>{profile.fetishes.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
              {memberRows.length ? (
                <div className="profile-members-detail-v116">
                  <h4>Personnes de la fiche</h4>
                  <p className="profile-members-note-v116">Un seul pseudo public est utilisé pour toute la fiche : <strong>{profile.pseudo}</strong>.</p>
                  {memberRows.map((member) => (
                    <article key={member.id}>
                      <strong>{member.title}</strong>
                      <div>{member.rows.map(([label, value]) => <InfoPair key={label} label={label} value={value} />)}</div>
                    </article>
                  ))}
                </div>
              ) : <DetailsLine profile={profile} />}
            </section>
          ) : null}

          {activePanel === 'photos' ? (
            <section className="profile-section-v116 profile-photos-v116">
              <div className="profile-section-title-v116"><div><p className="eyebrow">Albums</p><h3>Albums publics</h3></div><small>{publicAlbums.length} album{publicAlbums.length > 1 ? 's' : ''}</small></div>
              <div className="profile-panel-albums-v97 profile-albums-v116">
                {publicAlbums.length ? publicAlbums.map((album) => <SocialAlbumPreview key={album.id} profile={profile} album={album} onRequestAlbum={onRequestAlbum} />) : null}
              </div>
              {(onOpenPrivateAlbum || onExchangePrivateAlbums) ? (
                <div className="profile-private-share-v116 profile-private-share-v138">
                  <h4>Albums privés</h4>
                  <p>Donnez à {profile.pseudo} l’accès à votre album privé pendant une durée choisie, ou proposez un échange réciproque.</p>
                  <div className="profile-private-actions-v138">
                    {onOpenPrivateAlbum ? <PrivateAlbumAccessButton profile={profile} albumGrant={albumGrant} onOpenPrivateAlbum={onOpenPrivateAlbum} /> : null}
                    {onExchangePrivateAlbums ? <PrivateAlbumExchangeButton profile={profile} onExchangePrivateAlbums={onExchangePrivateAlbums} /> : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}


          {activePanel === 'prives' ? (
            <section className="profile-section-v116 profile-photos-v116">
              <div className="profile-section-title-v116"><div><p className="eyebrow">Albums privés</p><h3>Accès sur demande</h3></div><small>{privateAlbums.length} album{privateAlbums.length > 1 ? 's' : ''}</small></div>
              <div className="profile-panel-albums-v97 profile-albums-v116">
                {privateAlbums.length ? privateAlbums.map((album) => <SocialAlbumPreview key={album.id} profile={profile} album={album} onRequestAlbum={onRequestAlbum} />) : <div className="profile-agenda-empty-v116"><strong>Aucun album privé.</strong><p>Les albums privés partagés par ce profil apparaîtront ici, accès sur demande.</p></div>}
              </div>
            </section>
          ) : null}
          {activePanel === 'agenda' ? (
            <section className="profile-section-v116 profile-agenda-v116">
              <div className="profile-section-title-v116"><div><p className="eyebrow">Agenda</p><h3>Disponibilités et sorties</h3></div></div>
              {Array.isArray(profile.events) && profile.events.length ? (
                <div className="profile-agenda-list-v116">
                  {profile.events.map((event) => (
                    <article key={event.id || event.title}>
                      <span>{event.date ? formatShortDate(event.date) : 'Bientôt'}</span>
                      <div><strong>{event.title || 'Sortie prévue'}</strong><small>{event.location || event.city || profile.city || 'Lieu à confirmer'}</small></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="profile-agenda-empty-v116"><strong>Aucun agenda public.</strong><p>Les sorties ou disponibilités partagées par le profil pourront apparaître ici plus tard.</p></div>
              )}
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function SocialAlbumPreview({ profile, album, onRequestAlbum }) {
  const locked = album.coverOnly || (album.visibility === 'private' && !album.unlocked);
  const status = album.coverOnly ? 'Couverture seule — abonnez-vous' : albumAccessStatusLabel(album);
  const waiting = album.access?.status === 'requested';
  return (
    <article className={cx('social-album-preview social-album-preview-v138', locked && 'locked', album.unlocked && 'unlocked')}>
      <div className="album-preview-cover" style={{ backgroundImage: `url(${profile.profilePhotoUrl || ''})` }}>
        <span>{locked ? '🔒' : album.visibility === 'private' ? '🔓' : '✦'}</span>
      </div>
      <div>
        <strong>{album.title}</strong>
        <small>{album.itemCount ?? (album.items || []).length} média(s) • {album.visibility === 'private' ? 'Privé' : 'Public'}</small>
        <p>{album.description}</p>
        <em className={cx('album-access-state-v138', locked && 'locked')}>{status}</em>
        {locked && !album.coverOnly ? <button type="button" className="small-btn" disabled={waiting} onClick={() => onRequestAlbum(profile.id, album.id)}>{waiting ? 'Demande envoyée' : 'Demander l’accès'}</button> : null}
      </div>
    </article>
  );
}

function ProfileStat({ value, label }) { return <span className="profile-stat"><strong>{value}</strong><em>{label}</em></span>; }

function DetailsLine({ profile }) {
  const d = profile.details || {};
  const members = Array.isArray(profile.members) ? profile.members : [];
  if (members.length) {
    const firstDetails = members.slice(0, 3).map((m, index) => `${memberRoleLabel(profile.category || profile.type, index)} : ${m.age} ans${m.gender ? `, ${m.gender}` : ''}${m.sexualOrientation ? `, ${m.sexualOrientation}` : ''}`).join(' • ');
    const extra = members.length > 3 ? ` • +${members.length - 3} autre(s)` : '';
    return <p className="details-line">{firstDetails}{extra}</p>;
  }
  const parts = [profile.age ? `${profile.age} ans` : '', d.heightCm ? `${d.heightCm} cm` : '', d.hairColor, d.eyeColor, d.origin].filter(Boolean);
  return <p className="details-line">{parts.join(' • ')}</p>;
}

function MembersPreview({ profile }) {
  const members = Array.isArray(profile.members) ? profile.members : [];
  if (!members.length) return <p className="details-line">Informations personnes non renseignées.</p>;
  return (
    <div className="members-preview social-members-preview">
      {members.slice(0, 6).map((member, index) => (
        <span key={`personne-${index}`}>
          <strong>{memberRoleLabel(profile.category || profile.type, index)}</strong>
          <em>{member.age} ans • {member.gender || 'Genre non renseigné'} • {member.sexualOrientation || 'Orientation non renseignée'}</em>
        </span>
      ))}
    </div>
  );
}

function MemberEditor({ title = 'Personnes du profil', category, members, options, onChange, requireDetails = false }) {
  const list = normalizeMembersForForm(members, category);
  const isCouple = isCoupleCategory(category);
  const isTrio = isTrioCategory(category);
  const isGroup = isGroupCategory(category);
  const min = isGroup ? 2 : isTrio ? 3 : isCouple ? 2 : 1;
  const max = isGroup ? 20 : isTrio ? 3 : isCouple ? 2 : 1;
  const genderOptions = options?.details?.genderOptions || fallbackOptions.details.genderOptions;
  function update(index, key, value) {
    const next = list.map((member, i) => {
      if (i !== index) return member;
      if (key === 'gender') {
        const allowed = orientationOptionsForGender(value);
        return { ...member, gender: value, sexualOrientation: allowed.includes(member.sexualOrientation) ? member.sexualOrientation : 'Non renseigné' };
      }
      return { ...member, [key]: value };
    });
    onChange(next);
  }
  function addMember() {
    if (list.length >= max) return;
    const nextIndex = list.length + 1;
    onChange([...list, { ...defaultMember(memberRoleLabel(category, nextIndex - 1), 'Non renseigné', 28), label: memberRoleLabel(category, nextIndex - 1) }]);
  }
  function removeMember(index) {
    if (list.length <= min) return;
    onChange(list.filter((_, i) => i !== index));
  }
  const helpText = isCouple
    ? 'Un seul pseudo public pour la fiche couple. Ici, renseigne seulement les détails de chaque personne.'
    : isTrio
      ? 'Un seul pseudo public pour la fiche trio. Ici, renseigne seulement les détails de chaque personne.'
      : isGroup
        ? 'Un seul pseudo public pour la fiche groupe. Ici, renseigne seulement les détails de chaque personne.'
        : 'Le pseudo public reste celui de la fiche. Ici, renseigne les détails de la personne.';
  return (
    <section className="member-editor">
      <div className="member-editor-head">
        <div>
          <span>{title}</span>
          <small>{helpText}</small>
        </div>
        {isGroup ? <button type="button" className="small-btn gold" onClick={addMember} disabled={list.length >= max}>+ Ajouter une personne</button> : null}
      </div>
      <div className={cx('member-grid', isGroup && 'member-grid-group')}>
        {list.map((member, index) => {
          const orientationOptions = orientationOptionsForGender(member.gender);
          return (
            <article className="member-card glass" key={index}>
              <div className="member-card-title">
                <strong>{isCouple ? `Partenaire ${index + 1}` : isTrio ? `Personne ${index + 1}` : `Personne ${index + 1}`}</strong>
                {isGroup && list.length > min ? <button type="button" className="tiny-danger" onClick={() => removeMember(index)}>Retirer</button> : null}
              </div>
              <div className="form-grid three compact-members">
                <Field label="Âge" type="number" value={member.age} onChange={(v) => update(index, 'age', v)} />
                <SelectField label="Genre" value={member.gender} options={genderOptions} onChange={(v) => update(index, 'gender', v)} />
                <SelectField label={requireDetails ? 'Sexualité *' : 'Sexualité'} value={member.sexualOrientation} options={orientationOptions} onChange={(v) => update(index, 'sexualOrientation', v)} />
                <SelectField label="Cheveux" value={member.hairColor} options={options.details.hairColors} onChange={(v) => update(index, 'hairColor', v)} />
                <SelectField label="Pilosité" value={member.hairStyle} options={options.details.hairStyles || []} onChange={(v) => update(index, 'hairStyle', v)} />
                <SelectField label="Yeux" value={member.eyeColor} options={options.details.eyeColors} onChange={(v) => update(index, 'eyeColor', v)} />
                <SelectField label={requireDetails ? 'Origine *' : 'Origine'} value={member.origin} options={options.details.origins} onChange={(v) => update(index, 'origin', v)} />
                <SelectField label={requireDetails ? 'Silhouette *' : 'Silhouette'} value={member.bodyType || 'Non renseigné'} options={options.details.bodyTypes || fallbackOptions.details.bodyTypes} onChange={(v) => update(index, 'bodyType', v)} />
                <Field label="Taille cm" type="number" value={member.heightCm} onChange={(v) => update(index, 'heightCm', v)} />
                <Field label="Poids kg" type="number" value={member.weightKg} onChange={(v) => update(index, 'weightKg', v)} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FollowsPage({ profiles, me, onFollow, onOpenProfile }) {
  const following = profiles.filter((p) => p.followedByMe);
  const popular = profiles.slice().sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0)).slice(0, 8);
  const newFaces = profiles.filter((p) => !p.followedByMe && !p.hidden).slice(0, 6);
  return (
    <section className="page social-page follows-page">
      <div className="social-hero glass compact-hero">
        <div><h1>Suivis & affinités</h1></div>
        <div className="social-kpis"><Stat value={following.length} label="suivis" /><Stat value={me.followerCount || 0} label="abonnés" /><Stat value={popular.length} label="populaires" /></div>
      </div>
      <div className="social-network-grid">
        <ListPanel title="Mes suivis" profiles={following} onFollow={onFollow} onOpenProfile={onOpenProfile} />
        <ListPanel title="Suggestions" profiles={newFaces} onFollow={onFollow} onOpenProfile={onOpenProfile} />
        <ListPanel title="Profils populaires" profiles={popular} onFollow={onFollow} onOpenProfile={onOpenProfile} />
      </div>
    </section>
  );
}
function ListPanel({ title, subtitle, profiles, onFollow, onOpenProfile }) {
  return (
    <article className="glass panel social-list-panel">
      <div className="panel-title-row small"><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div></div>
      <div className="social-list-stack">
        {profiles.map((p) => <div className="mini-row social-mini-row" key={p.id}><button type="button" className="profile-open-chip" onClick={() => onOpenProfile?.(p)}><Avatar profile={p} /><span><strong>{p.pseudo}</strong><small>{p.city} • {distanceLabel(p)} • {p.category || p.type}</small></span></button><button type="button" className={cx('small-btn', p.followedByMe && 'gold')} onClick={() => onFollow(p.id)}>{p.followedByMe ? 'Suivi' : 'Suivre'}</button></div>)}
        {!profiles.length && (
          <ActionEmptyState
            icon="♡"
            title="Aucun profil."
            subtitle="Les suivis et suggestions apparaîtront ici quand la communauté grandira."
            tips={["Suivre un profil permet de retrouver ses nouveautés plus vite."]}
          />
        )}
      </div>
    </article>
  );
}

function ToktakFeed({ videos, me, onLike, onView, onShare, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, onOpenProfile, onRefresh, showToast }) {
  const publicVideos = useMemo(() => (Array.isArray(videos) ? videos : [])
    .filter((entry) => entry?.media?.type === 'video')
    .sort((a, b) => new Date(b.media.createdAt || 0) - new Date(a.media.createdAt || 0)), [videos]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const shellRef = useRef(null);
  const cardRefs = useRef({});

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, publicVideos.length - 1)));
  }, [publicVideos.length]);

  useEffect(() => {
    const root = shellRef.current;
    if (!root || !publicVideos.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number(visible.target.getAttribute('data-index'));
      if (Number.isFinite(index)) setActiveIndex(index);
    }, { root: null, threshold: [0.55, 0.72, 0.9] });
    Object.values(cardRefs.current).forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [publicVideos.length]);

  const activeEntry = publicVideos[activeIndex] || null;
  const activeMedia = activeEntry?.media || null;
  const totalLikes = publicVideos.reduce((sum, entry) => sum + Number(entry.media?.likeCount || 0), 0);
  const totalComments = publicVideos.reduce((sum, entry) => sum + Number(entry.media?.commentCount || 0), 0);

  function scrollToVideo(index) {
    const safeIndex = Math.min(Math.max(index, 0), publicVideos.length - 1);
    const node = cardRefs.current[safeIndex];
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); scrollToVideo(activeIndex + 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); scrollToVideo(activeIndex - 1); }
    if (event.key.toLowerCase() === 'm') setMuted((value) => !value);
  }

  return (
    <section className="page toktak-page v64-toktak-page" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="toktak-topline v64-toktak-topline">
        <div>
          <p className="eyebrow">Toktak</p>
          <h2>Vidéos publiques</h2>
        </div>
        <div className="toktak-live-stats" aria-label="Statistiques Toktak">
          <span><b>{publicVideos.length}</b><small>vidéos</small></span>
          <span><b>{totalLikes}</b><small>j’aime</small></span>
          <span><b>{totalComments}</b><small>commentaires</small></span>
        </div>
      </div>

      <div className="toktak-toolbar v64-toktak-toolbar glass">
        <button type="button" className="primary-btn" onClick={() => setUploadOpen(true)}>＋ Publier une vidéo</button>
        <button type="button" className="secondary-btn" onClick={() => setMuted((value) => !value)}>{muted ? 'Activer le son' : 'Couper le son'}</button>
        {activeMedia ? <span>Lecture {activeIndex + 1}/{publicVideos.length} • {activeMedia.viewCount || 0} vue{Number(activeMedia.viewCount || 0) > 1 ? 's' : ''}</span> : <span>Aucune vidéo active</span>}
      </div>

      <div className="toktak-feed-shell v64-toktak-feed-shell" ref={shellRef} aria-label="Flux vidéo Toktak façon TikTok">
        {publicVideos.map(({ owner, album, media }, index) => (
          <ToktakCard
            key={media.id}
            refNode={(node) => { if (node) cardRefs.current[index] = node; }}
            index={index}
            active={index === activeIndex}
            muted={muted}
            owner={owner}
            album={album}
            media={media}
            onLike={onLike}
            onView={onView}
            onShare={onShare}
            onComment={onComment}
            onCommentLike={onCommentLike}
            onCommentDelete={onCommentDelete}
            onCommentReply={onCommentReply}
            onCommentReport={onCommentReport}
            onCommentPin={onCommentPin}
            onOpenProfile={onOpenProfile}
            onToggleMuted={() => setMuted((value) => !value)}
            onNext={() => scrollToVideo(index + 1)}
            onPrevious={() => scrollToVideo(index - 1)}
            isFirst={index === 0}
            isLast={index === publicVideos.length - 1}
          />
        ))}
        {!publicVideos.length && (
          <ActionEmptyState
            icon="▶"
            title="Aucune vidéo publique pour l’instant."
            subtitle="Publiez une vidéo dans un album public : elle apparaîtra ici automatiquement."
            primaryLabel="Publier une vidéo"
            onPrimary={() => setUploadOpen(true)}
            tips={["Format conseillé : vertical, court et lumineux.", "Les vidéos publiques donnent plus de visibilité au profil."]}
          />
        )}
      </div>

      {uploadOpen ? <ToktakUploadSheet me={me} onClose={() => setUploadOpen(false)} onRefresh={onRefresh} showToast={showToast} /> : null}
    </section>
  );
}
function ToktakCard({ refNode, index, active, muted, owner, album, media, onLike, onView, onShare, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, onOpenProfile, onToggleMuted, onNext, onPrevious, isFirst, isLast }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const videoRef = useRef(null);
  const viewedRef = useRef(false);
  const tapRef = useRef({ time: 0 });
  const likeCount = Number(media.likeCount || 0);
  const commentCount = Number(media.commentCount || (media.comments || []).length || 0);
  const shareCount = Number(media.shareCount || 0);
  const viewCount = Number(media.viewCount || 0);
  const videoSrc = media.url || media.dataUrl || media.src || '';
  const likedLabel = media.liked ? 'Retirer le j’aime' : 'J’aime cette vidéo';
  const commentsLabel = `${commentCount} commentaire${commentCount > 1 ? 's' : ''}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (active && !paused) {
      video.play().catch(() => {});
      if (!viewedRef.current && media.id) {
        viewedRef.current = true;
        onView?.(media.id);
      }
    } else {
      video.pause();
    }
  }, [active, muted, paused, media.id, onView]);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setPaused(false);
      await video.play().catch(() => {});
    } else {
      setPaused(true);
      video.pause();
    }
  }

  function pulseHeart() {
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 620);
  }

  function handleStagePointer() {
    const now = Date.now();
    if (now - tapRef.current.time < 300) {
      pulseHeart();
      if (!media.myReaction) onLike?.(media.id, 'heart');
      tapRef.current.time = 0;
      return;
    }
    tapRef.current.time = now;
    window.setTimeout(() => {
      if (Date.now() - tapRef.current.time >= 280) togglePlay();
    }, 285);
  }

  async function shareVideo() {
    const text = `${owner?.pseudo || 'Membre'} sur Toktak : ${media.title || 'vidéo publique'}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Toktak', text, url: window.location.href });
      else await navigator.clipboard?.writeText(window.location.href);
      onShare?.(media.id);
    } catch {
      // Partage annulé : aucune erreur affichée.
    }
  }

  return (
    <article className="toktak-card v64-toktak-card" aria-label={media.title || 'Vidéo Toktak'} data-index={index} ref={refNode}>
      <div className="toktak-stage v64-toktak-stage">
        <button type="button" className="toktak-video-hitarea" onClick={handleStagePointer} aria-label="Lire ou mettre en pause la vidéo" />
        {videoSrc ? (
          <video ref={videoRef} className="toktak-video" src={videoSrc} playsInline loop muted={muted} preload={active ? 'auto' : 'metadata'} />
        ) : (
          <div className="toktak-video-placeholder"><span>▶</span><strong>{media.title || 'Vidéo publique'}</strong><small>Cette publication n’a pas encore de fichier vidéo associé.</small></div>
        )}
        <div className="toktak-gradient top" />
        <div className="toktak-gradient bottom" />
        {heartBurst ? <div className="toktak-heart-burst" aria-hidden="true">♥</div> : null}
        <div className="toktak-video-controls" aria-label="Contrôles vidéo">
          <button type="button" onClick={onPrevious} disabled={isFirst} aria-label="Vidéo précédente">↑</button>
          <button type="button" onClick={onToggleMuted} aria-label={muted ? 'Activer le son' : 'Couper le son'}>{muted ? '🔇' : '🔊'}</button>
          <button type="button" onClick={onNext} disabled={isLast} aria-label="Vidéo suivante">↓</button>
        </div>
        <div className="toktak-actions" aria-label="Actions Toktak">
          <button type="button" className="toktak-owner" onClick={() => onOpenProfile?.(owner)} aria-label={`Voir le profil de ${owner?.pseudo || 'ce membre'}`}><Avatar profile={owner} /><b>+</b></button>
          <button type="button" className={cx('toktak-action', media.liked && 'liked')} onClick={() => { pulseHeart(); onLike?.(media.id, media.myReaction === 'heart' ? 'heart' : 'heart'); }} aria-label={likedLabel} aria-pressed={Boolean(media.liked)}><i>{media.liked ? '♥' : '♡'}</i><span>{likeCount}</span></button>
          <button type="button" className="toktak-action" onClick={() => setCommentsOpen(true)} aria-label={commentsLabel}><i>💬</i><span>{commentCount}</span></button>
          <button type="button" className="toktak-action" onClick={shareVideo} aria-label="Partager"><i>↗</i><span>{shareCount || 'Partager'}</span></button>
        </div>
        <div className="toktak-caption">
          <button type="button" className="toktak-author" onClick={() => onOpenProfile?.(owner)}>@{owner?.pseudo || 'membre'}</button>
          <h3>{media.title || 'Vidéo publique'}</h3>
          <p>{media.caption || `Publié dans ${album?.title || 'un album public'}.`}</p>
          <small>♫ Son original • {album?.title || 'Album public'} • {viewCount} vue{viewCount > 1 ? 's' : ''}</small>
        </div>
        <button type="button" className="toktak-comment-pill" onClick={() => setCommentsOpen(true)}>💬 Ajouter un commentaire…</button>
      </div>
      {commentsOpen ? (
        <ToktakCommentsSheet
          media={media}
          onClose={() => setCommentsOpen(false)}
          onComment={onComment}
          onCommentLike={onCommentLike}
          onCommentDelete={onCommentDelete}
        />
      ) : null}
    </article>
  );
}
function ToktakUploadSheet({ me, onClose, onRefresh, showToast }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const publicAlbums = (me?.albums || []).filter((album) => album.visibility === 'public');
  const [albumId, setAlbumId] = useState(publicAlbums[0]?.id || '');

  useEffect(() => {
    if (!albumId && publicAlbums[0]?.id) setAlbumId(publicAlbums[0].id);
  }, [albumId, publicAlbums]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function selectFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('video/')) {
      showToast?.('Choisis une vidéo MP4, WebM ou MOV.');
      return;
    }
    if (nextFile.size > TOKTAK_VIDEO_MAX_BYTES) {
      showToast?.('Vidéo trop lourde : maximum 25 Mo pour Toktak.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setTitle((current) => current || nextFile.name.replace(/\.[^.]+$/, '').slice(0, 80));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) { showToast?.('Ajoute une vidéo avant de publier.'); return; }
    const safeTitle = title.trim();
    if (!safeTitle) { showToast?.('Ajoute un titre à ta vidéo.'); return; }
    setBusy(true);
    try {
      let targetAlbumId = albumId;
      if (!targetAlbumId) {
        const created = await apiFetch('/albums', { method: 'POST', body: JSON.stringify({ title: 'Vidéos Toktak', description: 'Vidéos publiques du profil.', visibility: 'public' }) });
        targetAlbumId = created.album?.id;
      }
      const dataUrl = await readFileAsDataUrl(file);
      await apiFetch(`/albums/${targetAlbumId}/media`, {
        method: 'POST',
        body: JSON.stringify({ type: 'video', title: safeTitle, caption: caption.trim(), dataUrl, mimeType: file.type, name: file.name }),
      });
      showToast?.('Vidéo publiée sur Toktak.');
      onClose?.();
      await onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Publication impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="toktak-comments-backdrop v64-upload-backdrop" role="dialog" aria-modal="true" aria-label="Publier une vidéo Toktak">
      <form className="toktak-upload-sheet" onSubmit={submit}>
        <div className="toktak-sheet-handle" />
        <div className="toktak-comments-head">
          <div><strong>Publier sur Toktak</strong><small>Vidéo publique visible dans le flux.</small></div>
          <button type="button" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="toktak-upload-grid">
          <button type="button" className="toktak-upload-preview" onClick={() => fileInputRef.current?.click()}>
            {previewUrl ? <video src={previewUrl} muted playsInline /> : <span><b>＋</b><em>Choisir une vidéo</em><small>MP4, WebM ou MOV • 25 Mo max</small></span>}
          </button>
          <div className="toktak-upload-fields">
            <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(event) => selectFile(event.target.files?.[0])} />
            <Field label="Titre" value={title} onChange={setTitle} placeholder="Titre de la vidéo" compact />
            <TextareaField label="Description" value={caption} onChange={setCaption} placeholder="Ajoute une légende…" />
            {publicAlbums.length ? (
              <SelectField label="Album public" value={albumId} options={publicAlbums.map((album) => ({ value: album.id, label: album.title || 'Album public' }))} onChange={setAlbumId} compact />
            ) : <p className="hint">Album public créé automatiquement.</p>}
          </div>
        </div>
        <div className="toktak-upload-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Publication…' : 'Publier la vidéo'}</button>
        </div>
      </form>
    </div>
  );
}
function ToktakCommentsSheet({ media, onClose, onComment, onCommentLike, onCommentDelete }) {
  const [comment, setComment] = useState('');
  const [showAll, setShowAll] = useState(false);
  const comments = Array.isArray(media.comments) ? media.comments : [];
  const visibleComments = showAll ? comments : comments.slice(-6);
  async function submit(e) {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    await onComment(media.id, body);
    setComment('');
    setShowAll(true);
  }
  function addEmoji(emoji) {
    setComment((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}${emoji} `);
  }
  return (
    <div className="toktak-comments-backdrop" role="dialog" aria-modal="true" aria-label="Commentaires Toktak">
      <div className="toktak-comments-sheet">
        <div className="toktak-sheet-handle" />
        <div className="toktak-comments-head">
          <strong>{comments.length} commentaire{comments.length > 1 ? 's' : ''}</strong>
          <button type="button" onClick={onClose} aria-label="Fermer les commentaires">×</button>
        </div>
        <div className="toktak-comments-list">
          {visibleComments.map((item) => <CommentItem key={item.id} mediaId={media.id} comment={item} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} />)}
          {!comments.length ? <p className="empty-comments">Aucun commentaire. Soyez le premier à réagir.</p> : null}
          {comments.length > visibleComments.length ? <button type="button" className="toktak-more-comments" onClick={() => setShowAll(true)}>Voir tous les commentaires</button> : null}
        </div>
        <form className="toktak-comment-form" onSubmit={submit}>
          <div className="comment-emoji-row" aria-label="Emojis rapides">
            {COMMENT_QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => addEmoji(emoji)}>{emoji}</button>)}
          </div>
          <div className="toktak-comment-input-row">
            <input value={comment} maxLength={600} onChange={(e) => setComment(e.target.value)} placeholder="Ajouter un commentaire…" />
            <button type="submit" disabled={!comment.trim()}>Publier</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AlbumsPage({ profiles = [], me, onRequestAlbum, onLike, onComment, onCommentLike, onCommentDelete, onOpenProfile }) {
  const [filter, setFilter] = useState('all');
  const all = profiles.flatMap((profile) => (profile.albums || []).map((album) => ({ profile, album })));
  const mine = all.filter(({ profile }) => profile?.id === me?.id);
  const filtered = all.filter(({ profile, album }) => {
    if (filter === 'mine') return profile?.id === me?.id;
    return filter === 'all' || album.visibility === filter;
  });
  const privateCount = all.filter(({ album }) => album.visibility === 'private').length;
  const publicCount = all.filter(({ album }) => album.visibility !== 'private').length;
  const mediaCount = all.reduce((sum, { album }) => sum + ((album.items || []).length), 0);
  const filterButtons = [
    ['all', 'Tous', all.length],
    ['public', 'Publics', publicCount],
    ['private', 'Privés', privateCount],
    ['mine', 'Mes albums', mine.length],
  ];
  return (
    <section className="page social-page albums-social-page albums-page-v121 albums-clean-v124">
      <div className="social-hero glass compact-hero albums-hero-v121 albums-hero-clean-v124">
        <h1>Photos & vidéos</h1>
      </div>
      <div className="panel-title-row social-title-row albums-title-clean-v124"><div><h2>{filtered.length} album(s)</h2></div><div className="feed-tabs compact-tabs">{filterButtons.map(([id, label, count]) => <button type="button" key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label} <em>{count}</em></button>)}</div></div>
      <div className="album-grid social-album-grid">
        {filtered.map(({ profile, album }) => <AlbumCard key={album.id} profile={profile} album={album} onRequestAlbum={onRequestAlbum} onLike={onLike} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onOpenProfile={onOpenProfile} />)}
        {!filtered.length && (
          <ActionEmptyState
            icon="🖼️"
            title={all.length ? 'Aucun album dans ce filtre.' : 'Aucun album pour le moment.'}
            subtitle={all.length ? 'Changez de filtre pour retrouver les albums disponibles.' : 'Les albums publics et privés des profils apparaîtront ici dès qu’ils seront créés.'}
            primaryLabel={all.length ? 'Voir tous les albums' : 'Compléter mon profil'}
            onPrimary={() => all.length ? setFilter('all') : onOpenProfile?.(me)}
            tips={["Public : parfait pour donner envie.", "Privé : idéal pour partager seulement après accord."]}
          />
        )}
      </div>
    </section>
  );
}

function AlbumCard({ profile, album, onRequestAlbum, onLike, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin, onOpenProfile }) {
  const locked = album.coverOnly || (album.visibility === 'private' && !album.unlocked);
  const items = album.items || [];
  return (
    <article className={cx('glass album-card social-album-card', locked && 'is-locked')}>
      <div className="album-social-cover" style={{ backgroundImage: `url(${profile.profilePhotoUrl || ''})` }}>
        <div className="album-social-overlay" />
        <span className="album-visibility">{album.visibility === 'private' ? '🔒 Privé' : '✦ Public'}</span>
        <button type="button" className="album-head social-album-head album-profile-open" onClick={() => onOpenProfile?.(profile)}><Avatar profile={profile} /><div><strong>{album.title}</strong><small>{profile.pseudo} • {album.itemCount ?? items.length} média(s)</small></div></button>
      </div>
      <div className="album-social-body">
        <p>{album.description}</p>
        {locked ? (
          album.coverOnly ? (
            <div className="locked-album social-locked-album"><span>🔒</span><p>Version d’essai : couverture seule. Abonnez-vous pour ouvrir cet album.</p></div>
          ) : (
            <div className="locked-album social-locked-album"><span>🔒</span><p>Album privé verrouillé.</p><button type="button" className="landing-btn-primary full" onClick={() => onRequestAlbum(profile.id, album.id)}>Demander l’accès</button></div>
          )
        ) : (
          <div className="media-grid social-media-grid">{items.slice(0, 8).map((m) => <MediaTile key={m.id} media={m} onLike={onLike} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} />)}</div>
        )}
      </div>
    </article>
  );
}
function MediaTile({ media, onLike, onComment, onCommentLike, onCommentDelete, onCommentReply, onCommentReport, onCommentPin }) {
  return (
    <div className="media-tile social-media-tile social-media-tile-pro">
      <div className="media-thumb"><span>{media.type === 'video' ? '▶' : '✦'}</span></div>
      <strong>{media.title}</strong>
      <small>{media.caption}</small>
      <SocialEngagementPanel media={media} onLike={onLike} onComment={onComment} onCommentLike={onCommentLike} onCommentDelete={onCommentDelete} onCommentReply={onCommentReply} onCommentReport={onCommentReport} onCommentPin={onCommentPin} compact />
    </div>
  );
}



function chatMessagePreview(message) {
  if (!message) return 'Conversation ouverte — dites bonjour avec respect.';
  if (message.attachment?.kind === 'gif') return `GIF • ${message.attachment.label || 'animation'}`;
  if (message.attachment?.kind === 'media') return message.attachment.type === 'video' ? 'Vidéo' : 'Photo';
  return message.body || 'Message';
}

function PermanentMediaMessage({ attachment }) {
  const [src, setSrc] = useState(attachment.dataUrl || '');
  useEffect(() => {
    let active = true; let obj = '';
    if (!attachment.dataUrl && attachment.url) {
      apiFetchBlobUrl(attachment.url).then((u) => { if (active) { obj = u; setSrc(u); } }).catch(() => {});
    }
    return () => { active = false; if (obj) URL.revokeObjectURL(obj); };
  }, [attachment.url, attachment.dataUrl]);
  const isVideo = attachment.type === 'video';
  if (!src) return <div className="chat-media-loading-v151" aria-live="polite">Chargement du média…</div>;
  return (
    <figure className="chat-media-message-v151">
      {isVideo
        ? <video src={src} controls playsInline />
        : <img src={src} alt={attachment.name || 'Média'} loading="lazy" />}
    </figure>
  );
}

function VoiceMessage({ attachment, mine }) {
  const [src, setSrc] = useState(attachment.dataUrl || '');
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const [cur, setCur] = useState(0);
  const audioRef = useRef(null);
  useEffect(() => {
    let active = true; let obj = '';
    if (attachment.dataUrl) {
      setSrc(attachment.dataUrl);
    } else if (attachment.url) {
      apiFetchBlobUrl(attachment.url).then((u) => { if (active) { obj = u; setSrc(u); } }).catch(() => {});
    }
    return () => { active = false; if (obj && obj.startsWith('blob:')) URL.revokeObjectURL(obj); };
  }, [attachment.url, attachment.dataUrl]);
  const dur = Math.max(0, Number(attachment.durationSeconds || 0));
  const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function toggle() {
    const a = audioRef.current; if (!a || !src) return;
    if (a.paused) { a.play().then(() => setPlaying(true)).catch(() => {}); } else { a.pause(); setPlaying(false); }
  }
  return (
    <div className={cx('voice-message-v181', mine && 'mine')}>
      <button type="button" className="voice-play-v181" onClick={toggle} aria-label={playing ? 'Pause' : 'Lire le message vocal'}>
        {playing ? '❚❚' : '►'}
      </button>
      <div className="voice-track-v181"><span className="voice-fill-v181" style={{ width: `${pct}%` }} /></div>
      <small className="voice-time-v181">{playing || pct ? fmt(cur) : fmt(dur)}</small>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onTimeUpdate={(e) => { const a = e.currentTarget; setCur(a.currentTime); if (a.duration && isFinite(a.duration)) setPct((a.currentTime / a.duration) * 100); }}
          onEnded={() => { setPlaying(false); setPct(0); setCur(0); }}
        />
      ) : null}
    </div>
  );
}

function useVoiceRecorder(showToast) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedRef = useRef(0);
  function pickMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    return cands.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
  }
  function clearTimer() { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } }
  function stopStream() { try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {} streamRef.current = null; }
  async function start() {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showToast?.('Enregistrement audio non supporté par ce navigateur.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const baseMime = String(rec.mimeType || mime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type: baseMime });
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        stopStream();
        if (!blob.size) { setResult(null); return; }
        try {
          const dataUrl = await readFileAsDataUrl(blob);
          setResult({ dataUrl, mimeType: baseMime, durationSeconds });
        } catch { showToast?.('Impossible de lire l’enregistrement.'); }
      };
      recRef.current = rec;
      rec.start();
      startedRef.current = Date.now();
      setSeconds(0); setResult(null); setRecording(true);
      timerRef.current = window.setInterval(() => {
        const s = Math.round((Date.now() - startedRef.current) / 1000);
        setSeconds(s);
        if (s >= 300) stop();
      }, 250);
    } catch {
      showToast?.('Micro indisponible. Autorisez l’accès au microphone.');
      stopStream();
    }
  }
  function stop() {
    clearTimer();
    setRecording(false);
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch {}
  }
  function cancel() {
    clearTimer();
    setRecording(false);
    setResult(null);
    try { if (recRef.current) { recRef.current.onstop = null; if (recRef.current.state !== 'inactive') recRef.current.stop(); } } catch {}
    stopStream();
  }
  function reset() { setResult(null); setSeconds(0); }
  return { recording, seconds, result, start, stop, cancel, reset };
}

function ChatAttachmentView({ message, activeId, me, showToast }) {
  const attachment = message.attachment;
  const [viewing, setViewing] = useState(false);
  const [remaining, setRemaining] = useState(Number(attachment?.expiresInSeconds || 5));
  const [locked, setLocked] = useState(Boolean(attachment?.consumed));
  const [objectUrl, setObjectUrl] = useState('');
  const isMine = message.fromId === me.id;
  const seconds = Number(attachment?.expiresInSeconds || 5);

  useEffect(() => {
    setLocked(Boolean(attachment?.consumed));
    setViewing(false);
    setRemaining(Number(attachment?.expiresInSeconds || 5));
    setObjectUrl('');
  }, [message.id, attachment?.consumed, attachment?.expiresInSeconds]);

  useEffect(() => {
    return () => {
      if (objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!attachment || attachment.kind !== 'media' || !isMine) return undefined;
    if (attachment.dataUrl) {
      setObjectUrl(attachment.dataUrl);
      return undefined;
    }
    if (!attachment.url) return undefined;
    apiFetchBlobUrl(attachment.url)
      .then((url) => { if (!cancelled) setObjectUrl(url); })
      .catch(() => { if (!cancelled) setObjectUrl(''); });
    return () => { cancelled = true; };
  }, [message.id, attachment?.url, attachment?.dataUrl, attachment?.kind, isMine]);

  useEffect(() => {
    if (!viewing) return undefined;
    setRemaining(seconds);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const next = Math.max(0, seconds - elapsed);
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(timer);
        setViewing(false);
        setLocked(true);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [viewing, seconds]);

  if (!attachment) return null;

  if (attachment.kind === 'audio') {
    return <VoiceMessage attachment={attachment} mine={isMine} />;
  }

  if (attachment.kind === 'gif') {
    return (
      <figure className="chat-gif-message">
        <img src={attachment.url} alt={attachment.label || 'GIF'} loading="lazy" />
        <figcaption>{attachment.label || 'GIF'}</figcaption>
      </figure>
    );
  }

  const hasProtectedSource = Boolean(attachment.url || attachment.dataUrl);
  const src = objectUrl || attachment.dataUrl;
  const isVideo = attachment.type === 'video';

  if (attachment.kind === 'media' && !attachment.ephemeral) {
    return <PermanentMediaMessage attachment={attachment} />;
  }

  async function startView() {
    if (!hasProtectedSource || locked) return;
    try {
      await apiFetch(`/conversations/${activeId}/messages/${message.id}/view`, { method: 'POST', body: JSON.stringify({}) });
      if (attachment.dataUrl) setObjectUrl(attachment.dataUrl);
      else if (attachment.url) setObjectUrl(await apiFetchBlobUrl(attachment.url));
      setRemaining(seconds);
      setViewing(true);
    } catch (err) {
      showToast(err.message || 'Média indisponible.');
    }
  }

  if (!isMine && (locked || !hasProtectedSource)) {
    return (
      <div className="ephemeral-media locked">
        <span>🔒</span>
        <strong>Média expiré</strong>
        <small>Cette {isVideo ? 'vidéo' : 'photo'} éphémère a déjà été ouverte.</small>
      </div>
    );
  }

  if (!isMine && !viewing) {
    return (
      <button type="button" className="ephemeral-media reveal" onClick={startView}>
        <span>{isVideo ? '🎥' : '📷'}</span>
        <strong>{isVideo ? 'Vidéo' : 'Photo'} éphémère</strong>
        <small>Cliquer pour voir pendant {seconds} secondes</small>
      </button>
    );
  }

  if (!src) {
    return (
      <div className="ephemeral-media reveal" aria-live="polite">
        <span>{isVideo ? '🎥' : '📷'}</span>
        <strong>Chargement du média sécurisé…</strong>
        <small>Le fichier n’est pas injecté dans le bootstrap.</small>
      </div>
    );
  }

  return (
    <figure className={cx('ephemeral-media-frame', !isMine && 'viewing')}>
      {isVideo ? (
        <video src={src} controls={isMine} autoPlay={!isMine} muted={!isMine} playsInline />
      ) : (
        <img src={src} alt={attachment.name || 'Média éphémère'} />
      )}
      <figcaption>
        <span>{isMine ? `Envoyé en mode éphémère ${seconds}s` : `Temps restant : ${remaining}s`}</span>
      </figcaption>
    </figure>
  );
}

function chatDayLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd’hui";
  if (sameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function Messages({ conversations, profiles = [], me, showToast, activeProfileId = '', onConversationOpened, onOpenProfile, onReport, onNavigate, canReply = true }) {
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loadingThread, setLoadingThread] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [ephemeralSeconds, setEphemeralSeconds] = useState(5);
  const [mediaDraft, setMediaDraft] = useState(null);
  const [gifDraft, setGifDraft] = useState(null);
  const voice = useVoiceRecorder(showToast);
  const fileInputRef = useRef(null);
  const gifInputRef = useRef(null);
  const streamRef = useRef(null);
  const conversationActive = conversations.find((c) => c.participant?.id === activeId);
  const profileActive = profiles.find((profile) => profile?.id === activeId);
  const active = conversationActive || (profileActive ? { id: `empty-${profileActive.id}`, participant: profileActive, unread: 0, messageCount: 0, messages: [], isEmpty: true } : null);
  const conversationProfileIds = useMemo(() => new Set(conversations.map((c) => c.participant?.id).filter(Boolean)), [conversations]);
  const filteredConversations = useMemo(() => {
    const q = normalize(query);
    return conversations.filter((c) => {
      const participant = c.participant || {};
      const haystack = normalize([participant.pseudo, participant.city, participant.category, chatMessagePreview(c.lastMessage)].join(' '));
      const matchText = !q || haystack.includes(q);
      const matchFilter = filter === 'all' || (filter === 'unread' && Number(c.unread || 0) > 0) || (filter === 'online' && participant.online);
      return matchText && matchFilter;
    });
  }, [conversations, query, filter]);
  const startableProfiles = useMemo(() => {
    const q = normalize(query);
    if (filter === 'unread') return [];
    return profiles
      .filter((profile) => profile?.id && profile.id !== me?.id && !conversationProfileIds.has(profile.id))
      .filter((profile) => filter !== 'online' || profile.online)
      .filter((profile) => {
        const haystack = normalize([profile.pseudo, profile.city, profile.category, profile.type].join(' '));
        return !q || haystack.includes(q);
      })
      .sort((a, b) => profileCompatibilityScore(b, me) - profileCompatibilityScore(a, me) || distanceValue(a) - distanceValue(b))
      .slice(0, 12);
  }, [profiles, me, conversationProfileIds, query, filter]);
  const suggestedProfiles = profiles
    .filter((profile) => profile?.id && profile.id !== me?.id && !conversationProfileIds.has(profile.id) && !profile.hidden)
    .sort((a, b) => profileCompatibilityScore(b, me) - profileCompatibilityScore(a, me) || distanceValue(a) - distanceValue(b))
    .slice(0, 3);

  useEffect(() => {
    const canOpenProfile = (profileId) => conversations.some((c) => c.participant?.id === profileId) || profiles.some((profile) => profile?.id === profileId);
    if (activeProfileId && canOpenProfile(activeProfileId)) {
      setActiveId(activeProfileId);
      onConversationOpened?.();
      return;
    }
    if (activeId && canOpenProfile(activeId)) return;
    setActiveId('');
  }, [conversations, profiles, activeId, activeProfileId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    setLoadingThread(true);
    apiFetch(`/conversations/${activeId}/messages`)
      .then((r) => { if (!cancelled) setMessages(r.messages || []); })
      .catch((e) => { if (!cancelled) showToast(e.message || 'Conversation indisponible.'); })
      .finally(() => { if (!cancelled) setLoadingThread(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  // Défilement automatique vers le dernier message (à l'ouverture et à chaque nouveau message).
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeId, loadingThread]);

  // Messagerie « instantanée » : on rafraîchit la conversation active toutes les 4 s.
  useEffect(() => {
    if (!activeId) return undefined;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      apiFetch(`/conversations/${activeId}/messages`)
        .then((r) => {
          const next = r.messages || [];
          setMessages((prev) => {
            const sameLength = next.length === prev.length;
            const sameLast = next[next.length - 1]?.id === prev[prev.length - 1]?.id;
            return sameLength && sameLast ? prev : next; // évite les re-rendus inutiles
          });
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, [activeId]);

  async function selectMedia(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showToast('Choisis une photo ou une vidéo.');
      return;
    }
    if (file.size > CHAT_MEDIA_MAX_BYTES) {
      showToast('Média trop lourd : maximum 7 Mo.');
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Lecture impossible.'));
      reader.readAsDataURL(file);
    }).catch((err) => {
      showToast(err.message || 'Lecture du fichier impossible.');
      return '';
    });
    if (!dataUrl) return;
    setGifDraft(null);
    setMediaDraft({
      kind: 'media',
      type: file.type.startsWith('video/') ? 'video' : 'image',
      mimeType: file.type,
      name: file.name,
      dataUrl,
      expiresInSeconds: Number(ephemeralSeconds),
    });
  }

  // GIF depuis le téléphone ou l'ordinateur (fichier .gif enregistré, trouvé sur Internet, etc.).
  async function selectGif(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/gif') {
      showToast('Choisis un fichier GIF (.gif).');
      return;
    }
    if (file.size > CHAT_MEDIA_MAX_BYTES) {
      showToast('GIF trop lourd : maximum 7 Mo.');
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Lecture impossible.'));
      reader.readAsDataURL(file);
    }).catch((err) => {
      showToast(err.message || 'Lecture du fichier impossible.');
      return '';
    });
    if (!dataUrl) return;
    setGifDraft(null);
    setShowGifs(false);
    setShowEmoji(false);
    setMediaDraft({
      kind: 'media',
      type: 'image',
      mimeType: 'image/gif',
      name: file.name || 'gif',
      dataUrl,
      expiresInSeconds: 0,
    });
  }

  async function send(e) {
    e.preventDefault();
    if (!activeId) return;
    const body = draft.trim().slice(0, 1200);
    const attachment = voice.result
      ? { kind: 'audio', dataUrl: voice.result.dataUrl, mimeType: voice.result.mimeType, durationSeconds: voice.result.durationSeconds }
      : mediaDraft ? { ...mediaDraft, expiresInSeconds: Number(ephemeralSeconds) } : gifDraft ? { kind: 'gif', url: gifDraft.url, label: gifDraft.label } : null;
    if (!body && !attachment) return;
    setDraft('');
    setMediaDraft(null);
    setGifDraft(null);
    voice.reset();
    try {
      const r = await apiFetch(`/conversations/${activeId}/messages`, { method: 'POST', body: JSON.stringify({ body, attachment }) });
      setMessages((cur) => [...cur, r.message]);
      setShowEmoji(false);
      setShowGifs(false);
    } catch (err) {
      setDraft(body);
      if (attachment?.kind === 'media') setMediaDraft(attachment);
      if (attachment?.kind === 'gif') setGifDraft(gifDraft);
      showToast(err.message || 'Message impossible à envoyer.');
    }
  }

  async function deleteMessage(messageId) {
    if (!activeId || !messageId) return;
    const prev = messages;
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, kind: 'deleted', body: '', attachment: null } : m)));
    try {
      await apiFetch(`/conversations/${activeId}/messages/${messageId}`, { method: 'DELETE' });
    } catch (err) {
      setMessages(prev);
      showToast(err.message || 'Suppression impossible.');
    }
  }

  function onComposerKeyDown(e) {
    // Entrée envoie le message ; Maj+Entrée (ou Ctrl/Cmd+Entrée) insère un saut de ligne / envoie.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  }

  return (
    <section className="page social-page messages-page social-messages-page v28-messages-page v47-messages-page messages-page-v121">
      <div className={cx('messenger glass social-messenger v28-messenger v47-messenger', active && 'has-active-v182')}>
        <aside className="conversation-list social-conversation-list v28-conversation-sidebar" aria-label="Liste des conversations">
          <div className="v28-conversation-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un profil…" />
            <div className="v28-message-filters" role="tablist" aria-label="Filtres messagerie">
              {[['all', 'Tous'], ['unread', 'Non lus'], ['online', 'En ligne']].map(([id, label]) => (
                <button type="button" key={id} className={cx(filter === id && 'active')} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="v28-conversation-scroll">
            {filteredConversations.map((c) => {
              const participant = c.participant || {};
              const last = chatMessagePreview(c.lastMessage);
              return (
                <button type="button" key={c.id} className={cx('conversation-item v28-conversation-item', activeId === participant.id && 'active')} onClick={() => setActiveId(participant.id)}>
                  <Avatar profile={participant} />
                  <span>
                    <strong>{participant.pseudo || 'Membre'}</strong>
                    <small>{last}</small>
                    <em>{participant.city || 'Ville discrète'} • {c.isTwoWay ? 'échange actif' : 'nouvelle discussion'}</em>
                  </span>
                  <i className={cx('v28-online-dot', participant.online && 'online')} aria-label={participant.online ? 'En ligne' : 'Hors ligne'} />
                  {Number(c.unread || 0) > 0 ? <b>{c.unread}</b> : null}
                </button>
              );
            })}
            {!filteredConversations.length ? (
              <ActionEmptyState
                icon="💬"
                title={conversations.length ? 'Aucune conversation trouvée.' : 'Votre messagerie est prête.'}
                subtitle={conversations.length ? 'Essayez de changer le filtre ou le mot-clé.' : 'Lancez une discussion avec un profil suggéré ou partez découvrir de nouveaux membres.'}
                primaryLabel={conversations.length ? 'Tout afficher' : 'Découvrir des profils'}
                onPrimary={() => conversations.length ? setFilter('all') : onNavigate?.('Recherche')}
                tips={['Conseil : un premier message court fonctionne mieux.', 'Respect et consentement avant tout.']}
              />
            ) : null}
          </div>
        </aside>

        <section className="chat-panel social-chat-panel v28-chat-panel v47-chat-panel" aria-label="Conversation active">
          {active ? (
            <>
              <div className="chat-header social-chat-header v28-chat-header v47-chat-header">
                <button type="button" className="chat-back-v182" aria-label="Retour aux conversations" onClick={() => setActiveId('')}>‹</button>
                <Avatar profile={active.participant} />
                <div>
                  <strong>{active.participant?.pseudo || 'Membre'}</strong>
                  <small>{active.participant?.city || 'Ville discrète'} • {active.participant?.category || active.participant?.type || 'Profil'} • salon privé</small>
                </div>
                <span className={cx('v28-status-pill', active.participant?.online && 'online')}>{active.participant?.online ? 'En ligne' : 'Discret'}</span>
                <div className="chat-header-actions-v121">
                  <button type="button" className="small-btn" onClick={() => onOpenProfile?.(active.participant)}>Voir profil</button>
                  <button type="button" className="secondary-btn danger-soft" onClick={() => onReport?.(active.participant, 'conversation')}>Signaler</button>
                </div>
              </div>

              <div className="v28-chat-safety v47-chat-safety">
                <span>🔒</span>
                <p>Échanges privés et sécurisés. Vos photos et vidéos restent dans la conversation.</p>
              </div>

              <div ref={streamRef} className="message-stream social-message-stream v28-message-stream v47-message-stream">
                {loadingThread ? <EmptyState title="Chargement de la conversation…" /> : null}
                {!loadingThread && messages.length === 0 ? (
                  <ActionEmptyState
                    icon="✨"
                    title="Aucun message pour l’instant."
                    subtitle={active.isEmpty ? 'Vous pouvez démarrer la conversation sans attendre un match.' : 'Envoyez un premier message simple, poli et personnalisé.'}
                    tips={[`Exemple : Bonjour ${active.participant?.pseudo || 'à vous'}, votre profil m’a intrigué.`, 'Évitez les messages trop directs dès la première phrase.']}
                  />
                ) : null}
                {!loadingThread && messages.flatMap((m, index) => {
                  const day = chatDayLabel(m.createdAt);
                  const prevDay = index > 0 ? chatDayLabel(messages[index - 1].createdAt) : null;
                  const mine = m.fromId === me.id;
                  const nodes = [];
                  if (day && day !== prevDay) {
                    nodes.push(<div className="chat-day-sep-v178" key={`day-${m.id || index}`}><span>{day}</span></div>);
                  }
                  nodes.push(
                    <div className={cx('message-bubble v28-message-bubble v47-message-bubble', mine && 'mine', m.kind === 'deleted' && 'is-deleted-v181')} key={m.id || index}>
                      {m.kind === 'deleted' ? (
                        <p className="message-deleted-v181"><em>Message supprimé</em></p>
                      ) : (
                        <>
                          {m.body ? <p>{m.body}</p> : null}
                          {m.attachment ? <ChatAttachmentView message={m} activeId={activeId} me={me} showToast={showToast} /> : null}
                        </>
                      )}
                      <small>{formatTime(m.createdAt)}{mine && m.kind !== 'deleted' ? (m.read ? ' ✓✓' : ' ✓') : ''}</small>
                      {mine && m.kind !== 'deleted' && m.id ? (
                        <button type="button" className="message-delete-v181" title="Supprimer ce message" aria-label="Supprimer ce message" onClick={() => deleteMessage(m.id)}>🗑</button>
                      ) : null}
                    </div>,
                  );
                  return nodes;
                })}
              </div>

              {canReply ? (
              <form className="message-form social-message-form v28-message-form v47-message-form" onSubmit={send}>
                {showEmoji ? (
                  <div className="v47-picker-panel">
                    <div className="v47-emoji-grid" aria-label="Emojis rapides">
                      {CHAT_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => setDraft((value) => `${value}${emoji}`)}>{emoji}</button>)}
                    </div>
                  </div>
                ) : null}

                {(mediaDraft || gifDraft) ? (
                  <div className="v47-attachment-preview">
                    <div>
                      {mediaDraft ? (mediaDraft.type === 'video' ? <video src={mediaDraft.dataUrl} muted playsInline /> : <img src={mediaDraft.dataUrl} alt={mediaDraft.name} />) : <img src={gifDraft.url} alt={gifDraft.label} />}
                      <span><strong>{mediaDraft ? (mediaDraft.mimeType === 'image/gif' ? 'GIF' : (mediaDraft.type === 'video' ? 'Vidéo' : 'Photo')) : `GIF ${gifDraft.label}`}</strong><small>{mediaDraft ? 'Envoyé dans la conversation' : 'Animation envoyée dans la conversation'}</small></span>
                    </div>
                    <button type="button" onClick={() => { setMediaDraft(null); setGifDraft(null); }}>Retirer</button>
                  </div>
                ) : null}

                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 1200))}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Écrire un message discret…"
                  rows="2"
                />
                {voice.recording ? (
                  <div className="voice-recorder-bar-v181" role="status">
                    <span className="voice-rec-dot-v181" aria-hidden="true" />
                    <strong>Enregistrement…</strong>
                    <span className="voice-rec-time-v181">{Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}</span>
                    <button type="button" className="voice-rec-cancel-v181" onClick={voice.cancel}>Annuler</button>
                    <button type="button" className="voice-rec-stop-v181" onClick={voice.stop}>Arrêter</button>
                  </div>
                ) : null}
                {voice.result && !voice.recording ? (
                  <div className="voice-preview-bar-v181">
                    <span>🎙 Message vocal prêt ({voice.result.durationSeconds}s)</span>
                    <button type="button" onClick={voice.reset}>Supprimer</button>
                  </div>
                ) : null}
                <div className="v47-composer-toolbar">
                  <div className="v47-tool-buttons">
                    <button type="button" title="Emoji" aria-label="Emoji" onClick={() => { setShowEmoji((v) => !v); setShowGifs(false); }}>😊</button>
                    <button type="button" onClick={() => gifInputRef.current?.click()} title="Envoyer un GIF" aria-label="GIF" style={{ fontSize: '13px', fontWeight: 600 }}>GIF</button>
                    <button type="button" title="Photo ou vidéo" aria-label="Photo ou vidéo" onClick={() => fileInputRef.current?.click()}>📎</button>
                    <button
                      type="button"
                      className={cx('voice-mic-btn-v181', voice.recording && 'recording')}
                      onClick={() => (voice.recording ? voice.stop() : voice.start())}
                      title={voice.recording ? 'Arrêter' : 'Message vocal'}
                      aria-label="Message vocal"
                    >{voice.recording ? '⏹' : '🎙'}</button>
                    <input ref={gifInputRef} type="file" accept="image/gif" onChange={selectGif} hidden />
                    <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={selectMedia} hidden />
                  </div>
                </div>
                <div className="v28-composer-actions v47-composer-actions">
                  <small>{draft.length}/1200 • Entrée pour envoyer, Maj+Entrée pour un saut de ligne</small>
                  <button type="submit" className="landing-btn-primary" disabled={!draft.trim() && !mediaDraft && !gifDraft && !voice.result}>Envoyer</button>
                </div>
              </form>
              ) : (
                <div className="messages-empty-panel-v121" style={{ padding: '16px 18px', borderRadius: '14px', border: '1px solid rgba(255,143,197,.3)', background: 'rgba(192,40,111,.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.35rem' }}>🔒</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block' }}>Lecture seule</strong>
                    <small style={{ color: '#d8b9c7' }}>Version d’essai : vous pouvez lire ce message mais pas répondre. Abonnez-vous pour discuter librement.</small>
                  </div>
                  {onNavigate ? <button type="button" className="small-btn" onClick={() => onNavigate('Abonnement')}>S’abonner</button> : null}
                </div>
              )}
            </>
          ) : (
            <div className="v28-no-thread v69-empty-chat-panel messages-empty-panel-v121">
              <ActionEmptyState
                icon="💌"
                title={profiles.length ? 'Choisissez un profil pour discuter.' : 'Aucun message pour l’instant.'}
                subtitle="Les conversations démarrées depuis Découvrir apparaîtront ici."
                primaryLabel="Trouver des profils"
                onPrimary={() => onNavigate?.('Recherche')}
              />
              {suggestedProfiles.length ? (
                <div className="messages-suggestions-v121">
                  {suggestedProfiles.map((profile) => (
                    <button type="button" key={profile.id} onClick={() => setActiveId(profile.id)}>
                      <Avatar profile={profile} />
                      <span><strong>{profile.pseudo || 'Profil'}</strong><small>{profile.city || 'Ville discrète'} • {profile.category || profile.type || 'Profil'}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}


function notificationCategory(notification = {}) {
  const text = normalize(`${notification.title || ''} ${notification.body || ''} ${notification.type || ''}`);
  if (text.includes('message') || text.includes('conversation') || text.includes('chat')) return 'Messages';
  if (text.includes('like') || text.includes('coeur') || text.includes('profil') || text.includes('visite')) return 'Rencontres';
  if (text.includes('album') || text.includes('media') || text.includes('photo') || text.includes('video')) return 'Médias';
  return 'Système';
}

function Notifications({ notifications = [], onReadAll, onNavigate }) {
  const [filter, setFilter] = useState('Toutes');
  const categories = ['Toutes', 'Non lues', 'Messages', 'Rencontres', 'Médias', 'Système'];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = notifications.filter((notification) => {
    if (filter === 'Toutes') return true;
    if (filter === 'Non lues') return !notification.read;
    return notificationCategory(notification) === filter;
  });
  return (
    <section className="page notifications-page-v121">
      <div className="messages-hero-v121 glass">
        <div>
          <p className="eyebrow">Alertes</p>
          <h2>Notifications</h2>
          <p>Suivez les messages, likes, demandes d’albums et informations importantes.</p>
        </div>
        <InsightStrip items={[
          { value: notifications.length, label: 'total' },
          { value: unreadCount, label: 'non lues', tone: unreadCount ? 'danger' : 'ok' },
          { value: notifications.filter((n) => notificationCategory(n) === 'Messages').length, label: 'messages' },
        ]} />
      </div>
      <article className="glass panel notifications-panel-v121">
        <div className="notifications-toolbar-v121">
          <div className="feed-tabs compact-tabs">
            {categories.map((category) => (
              <button type="button" key={category} className={filter === category ? 'active' : ''} onClick={() => setFilter(category)}>{category}</button>
            ))}
          </div>
          <button type="button" className="secondary-btn" onClick={onReadAll} disabled={!unreadCount}>Tout marquer comme lu</button>
        </div>
        <div className="notifications-list-v121">
          {filtered.map((n) => {
            const category = notificationCategory(n);
            const goLabel = category === 'Messages' ? 'Ouvrir messages' : category === 'Médias' ? 'Voir médias' : category === 'Rencontres' ? 'Découvrir' : '';
            const goTarget = category === 'Messages' ? 'Messages' : category === 'Médias' ? 'Médias' : category === 'Rencontres' ? 'Recherche' : '';
            return (
              <div className={cx('notification-row notification-row-v121', !n.read && 'unread')} key={n.id}>
                <Avatar profile={n.actor} />
                <div><strong>{n.title}</strong><p>{n.body}</p><small>{category} • {formatDate(n.createdAt)}</small></div>
                {goLabel ? <button type="button" className="small-btn" onClick={() => onNavigate?.(goTarget)}>{goLabel}</button> : null}
              </div>
            );
          })}
          {!filtered.length ? (
            <ActionEmptyState
              icon="🔔"
              title={notifications.length ? 'Aucune notification dans ce filtre.' : 'Aucune notification.'}
              subtitle="Les likes, messages, demandes d’albums et alertes système apparaîtront ici."
              primaryLabel={notifications.length ? 'Tout afficher' : 'Découvrir des profils'}
              onPrimary={() => notifications.length ? setFilter('Toutes') : onNavigate?.('Recherche')}
            />
          ) : null}
        </div>
      </article>
    </section>
  );
}


function SubscriptionPage({ plans, subscription, onActivate, onCheckout, showToast }) {
  const [promoCode, setPromoCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(plans[1]?.id || plans[0]?.id || '30d');
  const [quote, setQuote] = useState(null);
  const [paying, setPaying] = useState(false);
  const selected = plans.find((plan) => plan.id === selectedPlan) || plans[0];
  const premiumBenefits = [
    ['Découverte complète', 'Voir les profils sans blocage et utiliser les filtres avancés.'],
    ['Messages privés', 'Lancer et poursuivre des conversations discrètes.'],
    ['Albums privés', 'Demander ou ouvrir des accès selon les règles du membre.'],
    ['Visibilité renforcée', 'Votre profil ressort mieux dans les parcours de découverte.'],
  ];
  const comparisonRows = [
    ['Consulter son espace', '✓', '✓'],
    ['Découvrir tous les profils', 'Limité', '✓'],
    ['Messages et interactions', 'Limité', '✓'],
    ['Albums privés et médias', 'Aperçu', '✓'],
  ];

  // Retour depuis Stripe Checkout : on lit le paramètre d'URL pour informer l'utilisateur.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('paiement');
    if (status === 'succes') {
      showToast('Paiement reçu. Votre accès est activé dès la confirmation Stripe.');
    } else if (status === 'annule') {
      showToast('Paiement annulé. Aucun montant n’a été débité.');
    }
    if (status) {
      params.delete('paiement');
      params.delete('session_id');
      const clean = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${clean ? `?${clean}` : ''}`);
    }
  }, []);

  async function fetchQuote(planId, code) {
    if (!code) { setQuote(null); return; }
    try {
      const result = await apiFetch('/subscriptions/quote', { method: 'POST', body: JSON.stringify({ planId, promoCode: code }) });
      setQuote(result.quote);
    } catch {
      setQuote(null);
    }
  }

  function handlePlanChange(planId) {
    setSelectedPlan(planId);
    fetchQuote(planId, promoCode);
  }

  async function preview(e) {
    e.preventDefault();
    try {
      const result = await apiFetch('/subscriptions/quote', { method: 'POST', body: JSON.stringify({ planId: selectedPlan, promoCode }) });
      setQuote(result.quote);
    } catch (err) {
      showToast(err.message || 'Code invalide ou expiré.');
      setQuote(null);
    }
  }

  // Code gratuit : activation directe sans paiement. Sinon : paiement Stripe.
  async function activateFree() {
    await onActivate(selectedPlan, promoCode);
  }

  async function pay() {
    if (paying) return;
    setPaying(true);
    try {
      await onCheckout(selectedPlan, promoCode);
    } finally {
      setPaying(false);
    }
  }

  return (
    <section className="page subscription-page">
      <div className="section-heading">
        <p className="eyebrow">Accès premium</p>
        <h2 style={{ fontFamily: 'Georgia, serif' }}>Choisissez votre formule</h2>

      </div>
      <div className="glass subscription-status subscription-status-v121">
        <strong>{subscription?.active ? `Abonnement actif : ${subscription.label}` : 'Aucun abonnement actif'}</strong>
        <p>{subscription?.active ? `Expire le ${formatDate(subscription.expiresAt)}` : 'Choisissez une formule ou entrez un code.'}</p>
      </div>

      <div className="premium-value-grid-v121">
        <article className="glass premium-benefits-v121">
          <p className="eyebrow">Ce que Premium débloque</p>
          <h3>Plus de rencontres, moins de blocages</h3>
          {premiumBenefits.map(([title, detail]) => <div key={title}><strong>{title}</strong><span>{detail}</span></div>)}
        </article>
        <article className="glass premium-compare-v121">
          <p className="eyebrow">Comparatif</p>
          <h3>Gratuit vs Premium</h3>
          <div className="premium-compare-table-v121">
            <span>Fonction</span><b>Gratuit</b><b>Premium</b>
            {comparisonRows.flatMap(([name, free, premium]) => [<span key={`${name}-name`}>{name}</span>, <em key={`${name}-free`}>{free}</em>, <strong key={`${name}-premium`}>{premium}</strong>])}
          </div>
        </article>
      </div>

      <form className="glass promo-panel promo-panel-v121" onSubmit={preview}>
        <h3>J’ai un code promo</h3>
        <Field label="Code promo / influenceur" value={promoCode} onChange={(value) => { setPromoCode(value.toUpperCase()); setQuote(null); }} placeholder="Votre code" />
        <div className="promo-actions">
          <button type="submit" className="secondary-btn">Vérifier le code</button>
          {quote?.free ? <button type="button" className="primary-btn" onClick={activateFree}>Activer {quote.accessDays || 30} jours gratuits</button> : null}
        </div>
        {quote ? (
          <div className={cx('quote-box', quote.free && 'success-box')}>
            <strong>{quote.free ? 'Code gratuit validé ✓' : `Code valide — Total : ${quote.amountLabel}`}</strong>
            <p>
              {quote.free
                ? `${quote.accessDays || 30} jours offerts sans paiement.`
                : `Formule ${selected?.label || quote.plan?.label} • vous économisez ${quote.discountLabel}`}
            </p>
            {!quote.free && (
              <button type="button" className="primary-btn" style={{ marginTop: 8 }} onClick={pay} disabled={paying}>
                {paying ? 'Redirection…' : `Payer et activer — ${quote.amountLabel}`}
              </button>
            )}
          </div>
        ) : null}
      </form>

      <div className="pricing-grid">
        {plans.map((plan) => {
          const isFeatured = plan.id === '30d' || plan.durationDays === 30;
          const pricePerDay = plan.priceCents && plan.durationDays > 5 ? (plan.priceCents / plan.durationDays / 100).toFixed(2).replace('.', ',') : null;
          return (
            <article className={cx('glass price-card', selectedPlan === plan.id && 'selected', isFeatured && 'featured')} key={plan.id}>
              <p className="eyebrow">{plan.highlight || (isFeatured ? 'Recommandé ★' : '')}</p>
              <h3>{plan.label}</h3>
              <strong>{money(plan.priceCents)}</strong>
              <small>{plan.durationDays} jour{plan.durationDays > 1 ? 's' : ''}</small>
              {pricePerDay ? <small style={{ color: 'rgba(255,236,230,.50)', fontSize: '.74rem', marginTop: 2 }}>soit {pricePerDay} €/jour</small> : null}
              <button type="button" className={cx('secondary-btn full', selectedPlan === plan.id && 'primary-btn')} onClick={() => handlePlanChange(plan.id)}>
                {selectedPlan === plan.id ? 'Sélectionné ✓' : 'Choisir cette formule'}
              </button>
            </article>
          );
        })}
      </div>

      <article className="glass panel">
        <h3 style={{ fontFamily: 'Georgia, serif', color: '#ff8fc5', marginBottom: 6 }}>Paiement sécurisé</h3>
        <p className="hint" style={{ marginTop: 0 }}>Via Stripe — aucune donnée bancaire stockée. Sans reconduction automatique. Accès immédiat après confirmation.</p>
        <button type="button" className="primary-btn full" onClick={pay} disabled={paying || quote?.free}>
          {quote?.free ? 'Utiliser le code gratuit ci-dessus' : paying ? 'Redirection vers Stripe…' : `Payer ${selected ? money(Math.max(0, selected.priceCents - (quote?.discountCents || 0))) : ''} — accès immédiat`}
        </button>
      </article>
    </section>
  );
}


const HEART_GENDER_OPTIONS = ['Homme', 'Femme', 'Couple', 'Trans', 'Trio', 'Groupe'];
function HeartPreferenceEditor({ value = {}, onChange }) {
  const selected = Array.isArray(value.heartAllowedGenders) && value.heartAllowedGenders.length ? value.heartAllowedGenders : HEART_GENDER_OPTIONS;
  function toggle(option) {
    const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    onChange({ ...value, heartAllowedGenders: next.length ? next : HEART_GENDER_OPTIONS });
  }
  return (
    <article className="glass heart-preferences-panel">
      <p className="eyebrow">Coups de cœur</p>
      <h3>Qui peut vous liker ?</h3>
      <div className="heart-preference-grid">
        {HEART_GENDER_OPTIONS.map((option) => (
          <button type="button" key={option} className={selected.includes(option) ? 'active' : ''} onClick={() => toggle(option)}>{option}</button>
        ))}
      </div>
      <label className="check-row"><input type="checkbox" checked={value.showProfileViews !== false} onChange={(e) => onChange({ ...value, showProfileViews: e.target.checked })} /> Afficher les visiteurs de mon profil dans l’espace utilisateur.</label>
    </article>
  );
}

function MyProfile({ me, options, onSaved, showToast }) {
  const [form, setForm] = useState(() => createProfileForm(me));
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('apercu');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationDraft, setVerificationDraft] = useState({ proofImageUrl: '', note: '' });
  useEffect(() => setForm(createProfileForm(me)), [me]);
  useEffect(() => setVerificationDraft({ proofImageUrl: me?.verificationRequest?.proofImageUrl || '', note: me?.verificationRequest?.note || '' }), [me]);
  function setDetail(key, value) { setForm((cur) => ({ ...cur, details: { ...cur.details, [key]: value } })); }
  function setMemberField(index, key, value) {
    setForm((cur) => {
      const nextMembers = normalizeMembersForForm(cur.members, cur.category, cur.age).map((member, i) => {
        if (i !== index) return member;
        if (key === 'gender') {
          const allowed = orientationOptionsForGender(value);
          return { ...member, gender: value, sexualOrientation: allowed.includes(member.sexualOrientation) ? member.sexualOrientation : 'Non renseigné' };
        }
        return { ...member, [key]: value };
      });
      return {
        ...cur,
        age: index === 0 && key === 'age' && !isMultiProfileCategory(cur.category) ? value : cur.age,
        members: nextMembers,
      };
    });
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/profiles/me', { method: 'PUT', body: JSON.stringify(buildProfilePayload(form)) });
      showToast('Profil enregistré.');
      await onSaved();
    } catch (err) { showToast(err.message); }
    finally { setBusy(false); }
  }
async function submitVerificationRequest() {
  if (!verificationDraft.proofImageUrl) { showToast('Ajoutez une photo de vérification.'); return; }
  setVerificationBusy(true);
  try {
    const result = await apiFetch('/profile-verification/request', {
      method: 'POST',
      body: JSON.stringify({ proofImageUrl: verificationDraft.proofImageUrl, note: verificationDraft.note }),
    });
    showToast(result.message || 'Demande envoyée.');
    await onSaved();
  } catch (err) {
    showToast(err.message || 'Envoi impossible.');
  } finally {
    setVerificationBusy(false);
  }
}


  const profileSections = [
    { id: 'apercu', label: 'Aperçu', icon: 'overview' },
    { id: 'identite', label: 'Identité', icon: 'identity' },
    { id: 'personnes', label: isMultiProfileCategory(form.category) ? 'Personnes' : 'Détails', icon: 'people' },
    { id: 'medias', label: 'Bio & médias', icon: 'albums' },
    { id: 'preferences', label: 'Préférences', icon: 'heart' },
  ];

const members = Array.isArray(form.members) ? form.members : [];
const verificationRequest = me?.verificationRequest || null;
const verificationStatus = me?.verified ? 'approved' : (verificationRequest?.status || 'none');
const verificationSubject = isCoupleCategory(form.category)
  ? 'une photo du couple'
  : isTrioCategory(form.category)
    ? 'une photo du trio'
    : isGroupCategory(form.category)
      ? 'une photo du groupe'
      : 'une photo de la personne';
  const filledChecks = [
    Boolean(form.pseudo),
    Boolean(form.city),
    Boolean(form.profilePhotoUrl),
    Boolean(form.bio),
    Boolean(form.interests),
    Boolean(form.lookingFor),
    members.length >= (isGroupCategory(form.category) ? 2 : isTrioCategory(form.category) ? 3 : isCoupleCategory(form.category) ? 2 : 1),
  ];
  const completion = Math.round((filledChecks.filter(Boolean).length / filledChecks.length) * 100);
  const previewProfile = {
    ...me,
    pseudo: form.pseudo || me?.pseudo,
    city: form.city || me?.city,
    category: form.category,
    type: form.category,
    age: form.age,
    members,
    profilePhotoUrl: form.profilePhotoUrl,
    headline: form.headline,
    bio: form.bio,
    interests: splitList(form.interests),
    lookingFor: splitList(form.lookingFor),
    freeTonight: Boolean(form.freeTonight),
  };
  const ownMedia = (Array.isArray(previewProfile.albums) ? previewProfile.albums : [])
    .flatMap((album) => (album.items || []).map((media) => ({ album, media })));
  const profileRoadmap = [
    { label: 'Photo', done: Boolean(form.profilePhotoUrl), target: 'medias' },
    { label: 'Bio', done: Boolean(form.bio && form.bio.length > 20), target: 'medias' },
    { label: 'Ville', done: Boolean(form.city), target: 'identite' },
    { label: 'Envies', done: Boolean(form.lookingFor), target: 'medias' },
    { label: 'Détails', done: filledChecks[6], target: 'personnes' },
  ];
  const bioTemplates = [
    'Ici pour échanger simplement, avec respect, feeling et discrétion. J’aime les rencontres naturelles, les discussions sincères et les moments sans pression.',
    'Profil discret, ouvert au dialogue et aux belles affinités. Le feeling, le consentement et la confiance passent avant tout.',
  ];
  const lookingTemplates = ['Discussions, feeling, rencontres respectueuses', 'Couples, femmes, hommes, événements, échanges discrets'];

  return (
    <section className="page social-page my-profile-page v25-my-profile-page">
      <div className="glass my-profile-hero-v25 myspace-ig-hero-v188">
        <div className="my-profile-cover-v25" style={{ backgroundImage: form.profilePhotoUrl ? `url(${form.profilePhotoUrl})` : '' }} />
        <div className="myspace-ig-head-v188">
          <div className="myspace-ig-ava-v188">
            <Avatar profile={previewProfile} large />
            <button type="button" className="myspace-ig-edit-v188" onClick={() => setSection('medias')} title="Changer la photo">✎</button>
          </div>
          <div className="profile-trust-strip-v127 profile-ig-stats-v187">
            <span><strong>{ownMedia.length}</strong><small>publications</small></span>
            <span><strong>{me?.followerCount || 0}</strong><small>abonnés</small></span>
            <span><strong>{me?.followingCount || 0}</strong><small>suivi(e)s</small></span>
          </div>
        </div>
        <div className="myspace-ig-bio-v188">
          <strong>{form.pseudo || 'Votre profil'}</strong>
          <p className="myspace-ig-meta-v188">{form.category} • {memberAgeLabel(previewProfile) || `${form.age} ans`} • {form.city || 'Ville à renseigner'}</p>
          <p>{form.bio || 'Ajoutez une bio pour donner envie aux autres membres de vous découvrir.'}</p>
        </div>
        <div className="myspace-ig-actions-v188">
          <button type="button" className="primary" onClick={() => setSection('identite')}>Modifier le profil</button>
          <button type="button" onClick={() => setSection('medias')}>Partager</button>
        </div>
      </div>

      <div className="profile-roadmap-v121 glass">
        <div>
          <p className="eyebrow">Qualité du profil</p>
          <h3>Les éléments qui inspirent confiance</h3>
        </div>
        <div className="profile-roadmap-steps-v121">
          {profileRoadmap.map((item) => (
            <button type="button" key={item.label} className={cx(item.done && 'done')} onClick={() => setSection(item.target)}>
              <i>{item.done ? '✓' : '+'}</i><span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>


<div className="glass profile-verification-card-v146">
  <div className="profile-verification-copy-v146">
    <p className="eyebrow">Vérification du profil</p>
    <h3>Badge visible par les autres membres</h3>
    <p>
      La vérification n’est <strong>pas obligatoire</strong>, mais elle inspire confiance.
      Pour votre catégorie, il faut envoyer {verificationSubject}, puis une photo où vous tenez un mot avec la date du jour.
      La demande est ensuite validée ou refusée par l’administration.
    </p>
    <div className="social-chip-row gold-chips">
      <span>{verificationStatus === 'approved' ? 'Profil vérifié' : verificationStatus === 'pending' ? 'En attente admin' : verificationStatus === 'rejected' ? 'À renvoyer' : 'Optionnel'}</span>
      <span>{me?.verified ? 'Badge affiché' : 'Aucun badge si non vérifié'}</span>
    </div>
    {verificationRequest?.reason ? <p className="hint">Dernier retour admin : {verificationRequest.reason}</p> : null}
    {!me?.verified ? (
      <div className="profile-verification-form-v146">
        <PhotoInput label="Photo de vérification" value={verificationDraft.proofImageUrl} onChange={(value) => setVerificationDraft((cur) => ({ ...cur, proofImageUrl: value }))} showToast={showToast} />
        <TextareaField label="Note pour l’admin (facultatif)" value={verificationDraft.note} onChange={(value) => setVerificationDraft((cur) => ({ ...cur, note: value }))} />
        <button type="button" className="primary-btn" disabled={verificationBusy} onClick={submitVerificationRequest}>{verificationBusy ? 'Envoi…' : verificationStatus === 'rejected' ? 'Renvoyer ma demande' : 'Envoyer ma demande'}</button>
      </div>
    ) : (
      <div className="profile-verification-approved-v146">
        <strong>✓ Profil validé</strong>
        <span>Le badge de vérification est affiché sur votre profil.</span>
      </div>
    )}
  </div>
  <div className="profile-verification-visual-v146">
    <img src="/verification-tutorial.png" alt="Tutoriel de vérification Voluptia" />
  </div>
</div>

<div className="profile-subtabs-v25" aria-label="Sous-catégories du profil">

        {profileSections.map((item) => (
          <button type="button" key={item.id} className={cx(section === item.id && 'active')} onClick={() => setSection(item.id)}>
            <i><Icon name={item.icon} /></i><span>{item.label}</span>
          </button>
        ))}
      </div>

      <form className="glass profile-edit-form styled-profile-form-v25" onSubmit={save}>
        {section === 'apercu' ? (
          <div className="profile-overview-grid-v25">
            <article className="profile-preview-card-v25 myspace-ig-card-v188 myspace-ig-wallcard-v188">
              <div className="myspace-ig-wall-head-v188"><span>▦ Mes photos</span><button type="button" onClick={() => setSection('medias')}>Ajouter</button></div>
              {ownMedia.length ? (
                <div className="profile-photo-grid-v116 profile-wall-grid-v187">
                  {ownMedia.slice(0, 18).map(({ album, media }) => (
                    <div key={media.id} className="profile-photo-tile-v116" style={{ backgroundImage: `url(${media.type === 'photo' ? mediaDisplayUrl(media, previewProfile) : form.profilePhotoUrl || defaultProfilePhoto(form.pseudo)})` }}>
                      <span>{media.type === 'video' ? '▶' : ''}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="myspace-ig-empty-v188">Ajoutez des photos pour composer votre mur, façon Instagram.</p>}
            </article>
            <article className="profile-checklist-v25">
              <p className="eyebrow">À compléter</p>
              <h3>Rendez votre profil plus attirant</h3>
              {[
                ['Pseudo', Boolean(form.pseudo), 'identite'],
                ['Ville', Boolean(form.city), 'identite'],
                ['Photo de profil', Boolean(form.profilePhotoUrl), 'medias'],
                ['Bio', Boolean(form.bio), 'medias'],
                ['Centres d’intérêt', Boolean(form.interests), 'medias'],
                ['Recherche', Boolean(form.lookingFor), 'medias'],
                ['Personnes du profil', filledChecks[6], 'personnes'],
              ].map(([label, done, target]) => (
                <button type="button" key={label} className={cx(done && 'done')} onClick={() => setSection(target)}>
                  <i>{done ? '✓' : '+'}</i><span>{label}</span><em>{done ? 'OK' : 'À faire'}</em>
                </button>
              ))}
            </article>
            <article className="profile-fast-actions-v25">
              <p className="eyebrow">Raccourcis</p>
              <h3>Modifier rapidement</h3>
              <button type="button" onClick={() => setSection('personnes')}>Gérer les personnes</button>
              <button type="button" onClick={() => setSection('medias')}>Ajouter photo / bio</button>
              <button type="button" onClick={() => setSection('preferences')}>Régler les coups de cœur</button>
              <label className="free-tonight-mini-v143">
                <input type="checkbox" checked={Boolean(form.freeTonight)} onChange={(e) => setForm({ ...form, freeTonight: e.target.checked })} />
                <span><strong>Libre ce soir</strong><small>{form.freeTonight ? 'Visible dans la recherche' : 'Masqué des recherches ce soir'}</small></span>
              </label>
            </article>
          </div>
        ) : null}

        {section === 'identite' ? (
          <div className="profile-pane-v25">
            <div className="pane-heading-v25"><p className="eyebrow">Identité publique</p><h2>Informations principales</h2></div>
            <div className="form-grid three">
              <Field label="Pseudo du profil" value={form.pseudo} onChange={(v) => setForm({ ...form, pseudo: v })} />
              <Field label="Âge responsable compte" type="number" value={form.age} onChange={(v) => setForm({ ...form, age: v, members: normalizeMembersForForm(form.members, form.category, v) })} />
              <CityField label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Paris, Lyon, Bruxelles…" />
              <SelectField label="Catégorie" value={form.category} options={options.categories || PROFILE_CATEGORIES} onChange={(v) => setForm({ ...form, category: v, orientation: v, members: normalizeMembersForForm(form.members, v, form.age) })} />
              <div className="geo-help-card">
                <strong>Ville approximative</strong>
              </div>
            </div>
            <div className="profile-quick-details-v131 glass">
              <div>
                <strong>Détails modifiables après inscription</strong>
                <small>Âge, genre, origine et silhouette restent modifiables ici à tout moment.</small>
              </div>
              <div className="form-grid three compact-members">
                <Field label="Âge affiché" type="number" value={members[0]?.age || form.age} onChange={(v) => setMemberField(0, 'age', v)} />
                <SelectField label="Genre" value={members[0]?.gender || 'Non renseigné'} options={options.details.genderOptions || fallbackOptions.details.genderOptions} onChange={(v) => setMemberField(0, 'gender', v)} />
                <SelectField label="Origine" value={members[0]?.origin || 'Non renseignée'} options={options.details.origins || fallbackOptions.details.origins} onChange={(v) => setMemberField(0, 'origin', v)} />
                <SelectField label="Silhouette" value={members[0]?.bodyType || 'Non renseigné'} options={options.details.bodyTypes || fallbackOptions.details.bodyTypes} onChange={(v) => setMemberField(0, 'bodyType', v)} />
              </div>
            </div>
            <div className="form-grid three">
              <Field label="Taille cm globale" value={form.details.heightCm} onChange={(v) => setDetail('heightCm', v)} type="number" />
              <Field label="Poids kg global" value={form.details.weightKg} onChange={(v) => setDetail('weightKg', v)} type="number" />
              <SelectField label="Expérience" value={form.details.experienceLevel} options={options.details.experienceLevels} onChange={(v) => setDetail('experienceLevel', v)} />
            </div>
          </div>
        ) : null}

        {section === 'personnes' ? (
          <div className="profile-pane-v25">
            <div className="pane-heading-v25"><p className="eyebrow">Composition du profil</p><h2>{isMultiProfileCategory(form.category) ? 'Un seul pseudo, détails séparés' : 'Détails de la personne'}</h2></div>
            <MemberEditor
              title={isCoupleCategory(form.category) ? 'Les deux personnes du couple' : isTrioCategory(form.category) ? 'Les trois personnes du trio' : isGroupCategory(form.category) ? 'Personnes du groupe' : 'Informations de la personne'}
              category={form.category}
              members={form.members}
              options={options}
              onChange={(members) => setForm({ ...form, members })}
            />
          </div>
        ) : null}

        {section === 'medias' ? (
          <div className="profile-pane-v25">
            <div className="pane-heading-v25"><p className="eyebrow">Présentation</p><h2>Bio, photo et envies</h2></div>
            <PhotoInput label="Photo de profil" value={form.profilePhotoUrl} onChange={(v) => setForm({ ...form, profilePhotoUrl: v })} showToast={showToast} />
            <TextareaField label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} />
            <div className="profile-template-row-v121">
              {bioTemplates.map((template, index) => <button type="button" key={template} onClick={() => setForm({ ...form, bio: template })}>Exemple bio {index + 1}</button>)}
            </div>
            <div className="form-grid two">
              <Field label="Centres d’intérêt" value={form.interests} onChange={(v) => setForm({ ...form, interests: v })} />
              <label className="field"><span>Recherche</span><input value={form.lookingFor ?? ''} onChange={(e) => setForm({ ...form, lookingFor: e.target.value })} placeholder="Couples, femmes, hommes, événements…" />
                <small className="field-hint-v121">{lookingTemplates.map((template) => <button type="button" key={template} onClick={() => setForm({ ...form, lookingFor: template })}>{template}</button>)}</small>
              </label>
              <Field label="Limites" value={form.limits} onChange={(v) => setForm({ ...form, limits: v })} />
              <Field label="Photos publiques" value={form.publicPhotos} onChange={(v) => setForm({ ...form, publicPhotos: v })} />
            </div>
            <div className="profile-chip-editor-v153">
              <div className="chip-editor-head-v189">
                <span className="field-label-v153">Types de rencontres</span>
                {form.meetingTypes?.length ? <button type="button" className="chip-clear-v189" onClick={() => setForm({ ...form, meetingTypes: [] })}>Effacer ({form.meetingTypes.length})</button> : null}
              </div>
              <p className="chip-hint-v189">Touchez pour sélectionner ou retirer ce que vous pratiquez.</p>
              <OptionChips options={(options.details?.meetingTypes) || []} selected={form.meetingTypes} onToggle={(opt) => setForm({ ...form, meetingTypes: toggleInList(form.meetingTypes, opt) })} />
            </div>
            <div className="profile-chip-editor-v153">
              <div className="chip-editor-head-v189">
                <span className="field-label-v153">Fétiches &amp; spécificités</span>
                {form.fetishes?.length ? <button type="button" className="chip-clear-v189" onClick={() => setForm({ ...form, fetishes: [] })}>Effacer ({form.fetishes.length})</button> : null}
              </div>
              <p className="chip-hint-v189">Touchez pour sélectionner ou retirer ce que vous pratiquez.</p>
              <OptionChips options={(options.details?.fetishes) || []} selected={form.fetishes} onToggle={(opt) => setForm({ ...form, fetishes: toggleInList(form.fetishes, opt) })} />
            </div>
          </div>
        ) : null}

        {section === 'preferences' ? (
          <div className="profile-pane-v25 preferences-pane-v25">
            <div className="pane-heading-v25"><p className="eyebrow">Réglages sociaux</p><h2>Contrôlez vos interactions</h2></div>
            <HeartPreferenceEditor value={form.socialPreferences} onChange={(socialPreferences) => setForm({ ...form, socialPreferences })} />
            <div className="free-tonight-card-v143">
              <div>
                <strong>Libre ce soir</strong>
                <small>Activez cette option pour apparaître dans le filtre “Libre ce soir” de la recherche.</small>
              </div>
              <SearchSwitch checked={Boolean(form.freeTonight)} onChange={(checked) => setForm({ ...form, freeTonight: checked })} label={form.freeTonight ? 'On' : 'Off'} />
            </div>
          </div>
        ) : null}

        <div className="profile-savebar-v25">
          <div>
            <strong style={{ fontFamily: 'Georgia, serif', fontSize: '1.05rem' }}>{form.pseudo || 'Profil'}</strong>
            <span style={{ fontSize: '.82rem', color: 'rgba(255,236,230,.52)' }}>{section === 'apercu' ? 'Aperçu' : profileSections.find((item) => item.id === section)?.label}</span>
          </div>
          <button type="submit" className="primary-btn" disabled={busy} style={{ minWidth: 180 }}>
            {busy ? 'Enregistrement…' : 'Sauvegarder les changements'}
          </button>
        </div>
      </form>
    </section>
  );
}

function vadmAva(id = '') {
  const palette = ['linear-gradient(135deg,#ff7eb6,#c0286f)', 'linear-gradient(135deg,#e7c08a,#b07d3d)', 'linear-gradient(135deg,#9b8cff,#5a3fb9)', 'linear-gradient(135deg,#6ee7b7,#2f9e78)', 'linear-gradient(135deg,#ff9d7e,#c0532a)', 'linear-gradient(135deg,#7ec8ff,#2f6fb9)'];
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % palette.length;
  return palette[h];
}
function vadmInitial(s = '') {
  const m = String(s).replace(/[^A-Za-zÀ-ÿ]/g, '');
  return (m.charAt(0) || '?').toUpperCase();
}

function ViewAsMember({ showToast }) {
  const [members, setMembers] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch('/admin/members?limit=100');
        setMembers(Array.isArray(result.members) ? result.members : []);
      } catch (e) { showToast(e.message || 'Chargement impossible.'); setMembers([]); }
    })();
  }, []);

  async function openProfile(member) {
    setLoadingProfile(true);
    setOpen({ loading: true, member });
    try {
      const result = await apiFetch(`/profiles/${encodeURIComponent(member.profileId)}`);
      setOpen({ profile: result.profile || {}, member });
    } catch (e) {
      showToast(e.message || 'Profil indisponible.');
      setOpen(null);
    } finally { setLoadingProfile(false); }
  }

  const list = (members || []).filter((m) => {
    if (!q) return true;
    const hay = `${m.profile?.pseudo || ''} ${m.email || ''} ${m.city || ''} ${m.type || ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <article className="glass panel vadm-viewas">
      <div className="vadm-privbanner"><span>🔓</span><p><b>Accès intégral activé.</b> Vous consultez tous les profils et leurs albums privés sans demande d’accès — réservé à la modération. Vos consultations ne sont pas comptées comme des vues pour les membres.</p></div>

      <label className="vadm-search-field">
        <span>🔍</span>
        <input type="search" value={q} placeholder="Rechercher un membre (pseudo, ville…)" onChange={(e) => setQ(e.target.value)} />
      </label>

      {members === null ? (
        <p className="vadm-muted">Chargement des profils…</p>
      ) : !list.length ? (
        <EmptyState title="Aucun profil" subtitle="Aucun membre ne correspond à la recherche." icon="◉" />
      ) : (
        <div className="vadm-pgrid">
          {list.map((m) => (
            <button type="button" key={m.id} className="vadm-pcard" onClick={() => openProfile(m)}>
              <span className="vadm-pcover" style={{ background: vadmAva(m.profileId) }}>
                <span className={cx('vadm-pdot', m.online ? 'on' : 'off')} />
                <span className="vadm-pava">{vadmInitial(m.profile?.pseudo || m.email)}</span>
              </span>
              <span className="vadm-pmeta">
                <span className="vadm-pnm">{m.profile?.pseudo || m.email}{m.verified ? <i className="vadm-vrf"> ✓</i> : null}</span>
                <small>{[m.type, m.city].filter(Boolean).join(' · ') || 'Profil'}</small>
                <span className="vadm-ptags">
                  {m.role === 'admin' ? <em className="vadm-tag gold">Admin</em> : null}
                  {m.suspended ? <em className="vadm-tag coral">Suspendu</em> : null}
                  {m.hidden ? <em className="vadm-tag mute">Masqué</em> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open ? (
        <div className="vadm-viewer" role="dialog" aria-label="Profil en vue membre" onClick={() => setOpen(null)}>
          <div className="vadm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="vadm-vbar">
              <span className="vadm-eye">◉</span>
              <span className="vadm-vt"><b>Vue membre · {open.member?.profile?.pseudo || open.member?.email}</b><small>Accès admin intégral — albums privés déverrouillés</small></span>
              <button type="button" className="vadm-back" onClick={() => setOpen(null)}>← Retour</button>
            </div>
            <div className="vadm-vbody">
              {open.loading || loadingProfile ? (
                <p className="vadm-muted">Chargement du profil…</p>
              ) : (
                <ProfileFullView profile={open.profile} member={open.member} showToast={showToast} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ProfileFullView({ profile = {}, member = {}, showToast }) {
  const albums = Array.isArray(profile.albums) ? profile.albums : [];
  const publicAlbums = albums.filter((a) => a.visibility !== 'private');
  const privateAlbums = albums.filter((a) => a.visibility === 'private');
  const interests = Array.isArray(profile.interests) ? profile.interests : [];
  const pseudo = profile.pseudo || member.profile?.pseudo || member.email || 'Profil';

  function MediaGrid({ items = [] }) {
    if (!items.length) return <p className="vadm-muted">Aucun média dans cet album.</p>;
    return (
      <div className="vadm-mgrid">
        {items.map((it, i) => {
          const src = it.url || it.dataUrl || '';
          const isVideo = it.type === 'video';
          return (
            <div className="vadm-tile" key={it.id || i} style={{ background: vadmAva((it.id || '') + i) }}>
              {src && !isVideo ? <img src={src} alt={it.title || 'média'} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <span className="vadm-tile-ic">{isVideo ? '🎬' : '📷'}</span>}
              {isVideo ? <span className="vadm-tile-vid">▶ Vidéo</span> : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="vadm-phero">
        <span className="vadm-bigava" style={{ background: vadmAva(profile.id || member.profileId) }}>{vadmInitial(pseudo)}</span>
        <div>
          <h2>{pseudo}{profile.verified ? <i className="vadm-vrf"> ✓</i> : null}</h2>
          <p className="vadm-psub">{[profile.type, profile.city, profile.ageDisplay || profile.age].filter(Boolean).join(' · ')}</p>
          <div className="vadm-ptags">
            {profile.verified ? <em className="vadm-tag mint">Vérifié</em> : <em className="vadm-tag amber">Non vérifié</em>}
            {member.suspended ? <em className="vadm-tag coral">Suspendu</em> : null}
            {member.hidden ? <em className="vadm-tag mute">Masqué</em> : null}
          </div>
        </div>
      </div>

      {(profile.headline || profile.bio) ? (
        <div className="vadm-block">
          <div className="vadm-lbl">À propos</div>
          {profile.headline ? <p className="vadm-headline">{profile.headline}</p> : null}
          {profile.bio ? <div className="vadm-bio">{profile.bio}</div> : null}
          {interests.length ? <div className="vadm-ichips">{interests.map((it, i) => <span key={i}>{it}</span>)}</div> : null}
          {profile.lookingFor ? <p className="vadm-look"><b>Recherche :</b> {profile.lookingFor}</p> : null}
        </div>
      ) : null}

      {publicAlbums.map((a) => (
        <div className="vadm-block" key={a.id || a.title}>
          <div className="vadm-lbl">{a.title || 'Album public'} <span className="vadm-cc">{(a.items || []).length} média(s)</span></div>
          <MediaGrid items={a.items || []} />
        </div>
      ))}

      {privateAlbums.length ? (
        <div className="vadm-block">
          <div className="vadm-lbl priv">🔓 Albums privés <span className="vadm-cc">{privateAlbums.reduce((s, a) => s + (a.items || []).length, 0)} média(s)</span></div>
          <div className="vadm-privbanner sm"><span>🛡️</span><p>Normalement verrouillés pour les membres. <b>Déverrouillés ici en mode admin</b> pour la modération.</p></div>
          {privateAlbums.map((a) => (
            <div key={a.id || a.title} style={{ marginTop: 12 }}>
              {a.title ? <div className="vadm-sublbl">{a.title}</div> : null}
              <MediaGrid items={a.items || []} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="vadm-vactions">
        <button type="button" className="vadm-ghost" onClick={() => showToast('Astuce : gérez ce compte depuis l’onglet Membres ou Modération.')}>⚙ Gérer ce compte</button>
      </div>
    </>
  );
}

function AdminTwoFactor({ showToast }) {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setStatus(await apiFetch('/admin/2fa/status')); }
    catch (e) { showToast(e.message || 'Chargement impossible.'); }
  }
  useEffect(() => { load(); }, []);

  async function startSetup() {
    setBusy(true);
    try { setSetup(await apiFetch('/admin/2fa/setup', { method: 'POST', body: JSON.stringify({}) })); setBackupCodes(null); setCode(''); }
    catch (e) { showToast(e.message || 'Erreur.'); } finally { setBusy(false); }
  }
  async function confirmEnable() {
    setBusy(true);
    try {
      const r = await apiFetch('/admin/2fa/enable', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
      setBackupCodes(r.backupCodes || []); setSetup(null); setCode(''); showToast(r.message || 'Activé.'); await load();
    } catch (e) { showToast(e.message || 'Code incorrect.'); } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try { const r = await apiFetch('/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }); setCode(''); setBackupCodes(null); showToast(r.message || 'Désactivé.'); await load(); }
    catch (e) { showToast(e.message || 'Code incorrect.'); } finally { setBusy(false); }
  }
  async function regen() {
    setBusy(true);
    try { const r = await apiFetch('/admin/2fa/backup-codes', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }); setBackupCodes(r.backupCodes || []); setCode(''); showToast(r.message || 'Nouveaux codes générés.'); await load(); }
    catch (e) { showToast(e.message || 'Code incorrect.'); } finally { setBusy(false); }
  }

  const codeInput = (
    <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code à 6 chiffres ou code de secours"
      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid rgba(255,228,240,.18)', background: 'rgba(0,0,0,.26)', color: '#fbeef2', fontSize: '1rem', letterSpacing: '.06em' }} />
  );
  const btn = (label, onClick, kind = 'primary') => (
    <button type="button" disabled={busy} onClick={onClick} style={{
      padding: '11px 18px', borderRadius: '12px', border: kind === 'danger' ? '1px solid rgba(255,111,111,.3)' : 'none', cursor: 'pointer', fontWeight: 700, fontSize: '.9rem',
      background: kind === 'danger' ? 'rgba(255,111,111,.12)' : (kind === 'ghost' ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#ff8fc5,#c0286f)'),
      color: kind === 'danger' ? '#ff6f6f' : (kind === 'ghost' ? '#fbeef2' : '#fff'),
    }}>{busy ? '…' : label}</button>
  );
  const backupBlock = backupCodes ? (
    <div style={{ marginTop: 16, padding: '16px 18px', borderRadius: 14, background: 'rgba(231,192,138,.08)', border: '1px solid rgba(231,192,138,.3)' }}>
      <strong style={{ color: '#e7c08a', display: 'block', marginBottom: 8 }}>Codes de secours — notez-les maintenant</strong>
      <p style={{ color: '#d8b9c7', fontSize: '.84rem', margin: '0 0 12px' }}>Chaque code n’est utilisable qu’une fois, si vous perdez votre téléphone. Ils ne seront plus jamais affichés.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
        {backupCodes.map((c) => <code key={c} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,.3)', color: '#fbeef2', textAlign: 'center', letterSpacing: '.08em', fontSize: '.92rem' }}>{c}</code>)}
      </div>
    </div>
  ) : null;

  return (
    <article className="glass panel" style={{ padding: 22 }}>
      <div className="ph"><div><p style={{ color: '#e7c08a', fontSize: '.68rem', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>Sécurité du compte</p><h3 style={{ margin: 0 }}>Authentification à deux facteurs (2FA)</h3></div></div>
      <p style={{ color: '#b598a4', fontSize: '.9rem', marginTop: 0 }}>Ajoutez une seconde étape à la connexion admin avec une application comme Google Authenticator, Authy ou 1Password.</p>

      {status === null ? (
        <p style={{ color: '#8c6f7c' }}>Chargement…</p>
      ) : setup ? (
        <div>
          <p style={{ fontWeight: 600 }}>1. Scannez ce QR code dans votre application :</p>
          {setup.qrDataUrl ? <img src={setup.qrDataUrl} alt="QR code 2FA" style={{ width: 200, height: 200, borderRadius: 12, background: '#fff', padding: 8 }} /> : null}
          <p style={{ color: '#b598a4', fontSize: '.84rem' }}>Ou saisissez la clé manuellement : <code style={{ color: '#e7c08a', background: 'rgba(0,0,0,.3)', padding: '3px 8px', borderRadius: 6 }}>{setup.secret}</code></p>
          <p style={{ fontWeight: 600, marginTop: 16 }}>2. Entrez le code affiché pour confirmer :</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 220 }}>{codeInput}</div>
            {btn('Activer le 2FA', confirmEnable)}
            {btn('Annuler', () => { setSetup(null); setCode(''); }, 'ghost')}
          </div>
        </div>
      ) : status.enabled ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(110,231,183,.1)', border: '1px solid rgba(110,231,183,.25)', marginBottom: 16 }}>
            <span style={{ fontSize: '1.2rem' }}>✅</span>
            <div><strong style={{ color: '#6ee7b7' }}>2FA activé</strong><div style={{ color: '#b598a4', fontSize: '.84rem' }}>{status.backupCodesRemaining} code(s) de secours restant(s).</div></div>
          </div>
          {backupBlock}
          <p style={{ fontWeight: 600, marginTop: 16 }}>Entrez un code pour gérer le 2FA :</p>
          <div style={{ marginBottom: 10 }}>{codeInput}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {btn('Régénérer les codes de secours', regen, 'ghost')}
            {btn('Désactiver le 2FA', disable, 'danger')}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(244,179,80,.1)', border: '1px solid rgba(244,179,80,.25)', marginBottom: 16 }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div><strong style={{ color: '#f4b350' }}>2FA désactivé</strong><div style={{ color: '#b598a4', fontSize: '.84rem' }}>Votre compte admin n’est protégé que par mot de passe.</div></div>
          </div>
          {btn('Activer la double authentification', startSetup)}
        </div>
      )}
    </article>
  );
}

function AdminPage({ showToast }) {
  const [overview, setOverview] = useState(null);
  const [activeSection, setActiveSection] = useState('Vue d’ensemble');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('Tous');
  const [reportFilter, setReportFilter] = useState('Ouverts');
  const [secret, setSecret] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({ code: '', type: 'percent', discountPercent: 20, freeDays: 30, influencerProfileId: '', influencerName: '', influencerEmail: '', commissionRate: 10, maxUsesPerProfile: 1, maxUsesTotal: '', validFrom: '', validUntil: '' });
  const [editPromo, setEditPromo] = useState(null);
  const [influencerForm, setInfluencerForm] = useState({ profileId: '', displayName: '', email: '', commissionRate: 20, notes: '' });
  const [userForm, setUserForm] = useState({ role: 'admin', pseudo: 'Administrateur', email: '', password: '', type: 'Admin', city: 'Paris', age: 30, hidden: true, verified: true, grantPremium: false, premiumDays: 30, planId: '30d' });
  const [warningForm, setWarningForm] = useState({ userId: '', severity: 'warning', message: '', hideProfile: false, revokeSessions: false });
  const [venues, setVenues] = useState([]);
  const [venueTypes, setVenueTypes] = useState([]);
  const [venueForm, setVenueForm] = useState({ name: '', type: 'Club libertin', address: '', description: '', phone: '', website: '' });
  const number = (value) => Number(value || 0).toLocaleString('fr-FR');
  const percent = (value) => `${Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

  async function load() {
    try { setOverview(await apiFetch('/admin/overview')); }
    catch (e) { showToast(e.message); }
  }
  async function loadVenues() {
    try {
      const result = await apiFetch('/admin/venues');
      setVenues(Array.isArray(result.venues) ? result.venues : []);
      setVenueTypes(Array.isArray(result.types) ? result.types : []);
    } catch (e) { showToast(e.message); }
  }
  async function createVenue(event) {
    event.preventDefault();
    if (!venueForm.name.trim() || !venueForm.address.trim()) { showToast('Nom et adresse obligatoires.'); return; }
    try {
      const result = await apiFetch('/admin/venues', { method: 'POST', body: JSON.stringify(venueForm) });
      showToast(result.message);
      setVenueForm({ name: '', type: venueForm.type, address: '', description: '', phone: '', website: '' });
      await loadVenues();
    } catch (e) { showToast(e.message); }
  }
  async function deleteVenue(id, name) {
    if (!(await appConfirm(`Supprimer « ${name} » de la carte ?`, { title: 'Supprimer le lieu', danger: true, confirmLabel: 'Supprimer' }))) return;
    try { const result = await apiFetch(`/admin/venues/${encodeURIComponent(id)}`, { method: 'DELETE' }); showToast(result.message); await loadVenues(); }
    catch (e) { showToast(e.message); }
  }
  async function relocateVenue(id, address) {
    const next = await appPrompt('Nouvelle adresse à localiser :', { title: 'Modifier l’adresse', defaultValue: address || '', placeholder: '12 rue Exemple, 75001 Paris', confirmLabel: 'Localiser' });
    if (next === null) return;
    try { const result = await apiFetch(`/admin/venues/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ address: next }) }); showToast(result.venue?.located ? 'Adresse localisée.' : 'Adresse non localisée, vérifiez la saisie.'); await loadVenues(); }
    catch (e) { showToast(e.message); }
  }
  useEffect(() => { if (activeSection === 'Lieux') loadVenues(); }, [activeSection]);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    setQuery('');
    setRoleFilter('Tous');
  }, [activeSection]);

  async function createPromo(event) {
    event.preventDefault();
    try {
      const body = {
        ...form,
        code: form.code.toUpperCase(),
        maxUsesTotal: form.maxUsesTotal ? Number(form.maxUsesTotal) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      const result = await apiFetch('/admin/promo-codes', { method: 'POST', body: JSON.stringify(body) });
      showToast(result.message || 'Code créé.');
      setForm({ code: '', type: 'percent', discountPercent: 20, freeDays: 30, influencerProfileId: '', influencerName: '', influencerEmail: '', commissionRate: 10, maxUsesPerProfile: 1, maxUsesTotal: '', validFrom: '', validUntil: '' });
      await load();
    } catch (err) { showToast(err.message || 'Création impossible.'); }
  }

  async function updatePromo(event) {
    event.preventDefault();
    if (!editPromo) return;
    try {
      const patch = {
        discountPercent: editPromo.discountPercent ? Number(editPromo.discountPercent) : undefined,
        freeDays: editPromo.freeDays ? Number(editPromo.freeDays) : undefined,
        maxUsesPerProfile: Number(editPromo.maxUsesPerProfile) || undefined,
        maxUsesTotal: editPromo.maxUsesTotal ? Number(editPromo.maxUsesTotal) : null,
        validFrom: editPromo.validFrom || null,
        validUntil: editPromo.validUntil || null,
        influencerProfileId: editPromo.influencerProfileId || null,
        influencerName: editPromo.influencerName || undefined,
        influencerEmail: editPromo.influencerEmail || undefined,
        commissionRate: editPromo.commissionRate !== undefined ? Number(editPromo.commissionRate) : undefined,
      };
      const result = await apiFetch(`/admin/promo-codes/${encodeURIComponent(editPromo.code)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      showToast(result.message || 'Code mis à jour.');
      setEditPromo(null);
      await load();
    } catch (err) { showToast(err.message || 'Mise à jour impossible.'); }
  }

  async function deletePromo(code) {
    if (!(await appConfirm(`Supprimer définitivement le code "${code}" ? Action irréversible.`, { title: 'Supprimer le code promo', danger: true, confirmLabel: 'Supprimer' }))) return;
    try {
      const result = await apiFetch(`/admin/promo-codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
      showToast(result.message || 'Code supprimé.');
      await load();
    } catch (err) { showToast(err.message || 'Suppression impossible.'); }
  }

  function exportCsv(type) {
    const token = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('session_token='))?.split('=')[1] || '';
    window.open(`/api/admin/export?type=${type}`, '_blank');
  }

  async function createUser(event) {
    event.preventDefault();
    setBusyId('create-user');
    try {
      const body = { ...userForm, age: Number(userForm.age || 30), premiumDays: Number(userForm.premiumDays || 30) };
      const result = await apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(body) });
      showToast(result.message || 'Compte créé.');
      if (result.temporaryPassword) setSecret({ title: 'Mot de passe temporaire du nouveau compte', email: body.email, password: result.temporaryPassword });
      setUserForm({ role: 'admin', pseudo: 'Administrateur', email: '', password: '', type: 'Admin', city: 'Paris', age: 30, hidden: true, verified: true, grantPremium: false, premiumDays: 30, planId: body.planId || '30d' });
      await load();
    } catch (err) { showToast(err.message || 'Création impossible.'); }
    finally { setBusyId(''); }
  }

  async function togglePromo(code) {
    try { const result = await apiFetch(`/admin/promo-codes/${encodeURIComponent(code)}/toggle`, { method: 'POST', body: JSON.stringify({}) }); showToast(result.message); await load(); }
    catch (err) { showToast(err.message || 'Action impossible.'); }
  }

  async function promoteToInfluencer(user) {
    if (user.role === 'admin') { showToast('Un compte admin ne peut pas être influenceur.'); return; }
    setBusyId(user.id);
    try {
      const body = { profileId: user.profileId, displayName: user.profile?.pseudo || user.email || '', email: user.email || '', commissionRate: 20 };
      const result = await apiFetch('/admin/influencers', { method: 'POST', body: JSON.stringify(body) });
      showToast(result.message || 'Promu influenceur (commission 20%).');
      await load();
    } catch (err) { showToast(err.message || 'Promotion impossible.'); }
    finally { setBusyId(''); }
  }

  async function copyProfileId(profileId) {
    try { await navigator.clipboard.writeText(profileId); showToast(`ID copié : ${profileId}`); }
    catch { showToast(`ID : ${profileId}`); }
  }

  async function createInfluencer(event) {
    event.preventDefault();
    if (!influencerForm.profileId) { showToast('Sélectionnez un compte membre.'); return; }
    setBusyId('create-influencer');
    try {
      const body = { ...influencerForm, commissionRate: Number(influencerForm.commissionRate || 0) };
      const result = await apiFetch('/admin/influencers', { method: 'POST', body: JSON.stringify(body) });
      showToast(result.message || 'Influenceur ajouté.');
      setInfluencerForm({ profileId: '', displayName: '', email: '', commissionRate: 20, notes: '' });
      await load();
    } catch (err) { showToast(err.message || 'Ajout impossible.'); }
    finally { setBusyId(''); }
  }

  async function updateInfluencer(influencer, patch) {
    setBusyId(`influencer-${influencer.profileId}`);
    try {
      const result = await apiFetch(`/admin/influencers/${encodeURIComponent(influencer.profileId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      showToast(result.message || 'Influenceur mis à jour.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  function prepareCodeForInfluencer(influencer) {
    setForm({
      ...form,
      code: String(influencer.pseudo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || '',
      influencerProfileId: influencer.profileId,
      influencerName: influencer.pseudo || influencer.profile?.pseudo || '',
      influencerEmail: influencer.email || '',
      commissionRate: Number(influencer.commissionRate || 20),
    });
    setEditPromo(null);
    setActiveSection('Code');
  }

  async function resolveReportWithAction(reportId, action, warnMessage = '') {
    try {
      const body = { action, warnMessage };
      const result = await apiFetch(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, { method: 'POST', body: JSON.stringify(body) });
      showToast(result.message || 'Signalement traité.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
  }
async function approveVerificationRequest(request) {
  setBusyId(`verification-${request.id}`);
  try {
    const result = await apiFetch(`/admin/profile-verifications/${encodeURIComponent(request.id)}/approve`, { method: 'POST', body: JSON.stringify({}) });
    showToast(result.message || 'Profil vérifié.');
    await load();
  } catch (err) {
    showToast(err.message || 'Action impossible.');
  } finally {
    setBusyId('');
  }
}

async function rejectVerificationRequest(request) {
  const reason = await appPrompt('Raison du refus (visible par le membre) :', {
    title: 'Refuser la vérification',
    defaultValue: request.reason || 'Photo non conforme. Merci de refaire une photo nette avec la date du jour.',
    placeholder: 'Expliquez brièvement quoi corriger…',
    confirmLabel: 'Refuser',
  });
  if (reason === null) return;
  setBusyId(`verification-${request.id}`);
  try {
    const result = await apiFetch(`/admin/profile-verifications/${encodeURIComponent(request.id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    showToast(result.message || 'Demande refusée.');
    await load();
  } catch (err) {
    showToast(err.message || 'Action impossible.');
  } finally {
    setBusyId('');
  }
}


  async function updateUser(user, patch) {
    setBusyId(user.id);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      showToast(result.message || 'Compte mis à jour.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  async function resetPassword(user) {
    const next = await appPrompt(`Nouveau mot de passe pour ${user.email}. Laisser vide puis valider pour générer un mot de passe fort.`, { title: 'Réinitialiser le mot de passe', inputType: 'text', placeholder: 'Vide = généré automatiquement', confirmLabel: 'Réinitialiser' });
    if (next === null) return;
    setBusyId(user.id);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/password`, { method: 'POST', body: JSON.stringify(next.trim() ? { password: next.trim() } : {}) });
      showToast(result.message || 'Mot de passe mis à jour.');
      if (result.temporaryPassword) setSecret({ title: 'Mot de passe temporaire généré', email: user.email, password: result.temporaryPassword });
      await load();
    } catch (err) { showToast(err.message || 'Réinitialisation impossible.'); }
    finally { setBusyId(''); }
  }

  async function grantPremium(user, days = 30) {
    setBusyId(user.id);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/subscription`, { method: 'POST', body: JSON.stringify({ days, planId: '30d' }) });
      showToast(result.message || 'Premium accordé.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  async function revokePremium(user) {
    setBusyId(user.id);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/subscription`, { method: 'POST', body: JSON.stringify({ action: 'revoke' }) });
      showToast(result.message || 'Premium retiré.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  async function revokeSessions(user) {
    setBusyId(user.id);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/sessions`, { method: 'DELETE' });
      showToast(result.message || 'Sessions fermées.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  async function sendAdminMessage(user) {
    const message = await appPrompt(`Message support à envoyer à ${user.profile?.pseudo || user.email} :`, { title: 'Message support', placeholder: 'Votre message…', confirmLabel: 'Envoyer' });
    if (message === null) return;
    const body = message.trim();
    if (!body) return;
    setBusyId(`message-${user.id}`);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/message`, { method: 'POST', body: JSON.stringify({ message: body }) });
      showToast(result.message || 'Message support envoyé.');
      await load();
    } catch (err) { showToast(err.message || 'Envoi impossible.'); }
    finally { setBusyId(''); }
  }


  async function suspendUser(user) {
    if (user.suspended) {
      setBusyId(user.id);
      try { const r = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/suspend`, { method: 'POST', body: JSON.stringify({ action: 'lift' }) }); showToast(r.message || 'Suspension levée.'); await load(); }
      catch (err) { showToast(err.message || 'Action impossible.'); } finally { setBusyId(''); }
      return;
    }
    const daysRaw = await appPrompt(`Suspendre ${user.profile?.pseudo || user.email} pendant combien de jours ?`, { title: 'Suspendre le compte', placeholder: '7', defaultValue: '7', inputType: 'number', confirmLabel: 'Continuer' });
    if (daysRaw === null) return;
    const days = Number(String(daysRaw).trim());
    if (!Number.isFinite(days) || days < 1) { showToast('Nombre de jours invalide.'); return; }
    const reason = await appPrompt('Motif (visible par le membre, facultatif) :', { title: 'Motif de la suspension', placeholder: 'Signalement, comportement…', confirmLabel: 'Suspendre' });
    if (reason === null) return;
    setBusyId(user.id);
    try { const r = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/suspend`, { method: 'POST', body: JSON.stringify({ days, reason: reason.trim() }) }); showToast(r.message || 'Compte suspendu.'); await load(); }
    catch (err) { showToast(err.message || 'Suspension impossible.'); } finally { setBusyId(''); }
  }

  async function deleteUser(user) {
    const ok = await appConfirm(`Supprimer définitivement le compte de ${user.profile?.pseudo || user.email} ? Ses messages seront anonymisés et ses médias mis en rétention 6 mois. Action irréversible.`, { title: 'Supprimer le compte', danger: true, confirmLabel: 'Supprimer définitivement' });
    if (!ok) return;
    setBusyId(user.id);
    try { const r = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }); showToast(r.message || 'Compte supprimé.'); await load(); }
    catch (err) { showToast(err.message || 'Suppression impossible.'); } finally { setBusyId(''); }
  }

  async function setReportStatus(report, status = 'reviewing') {
    setBusyId(`report-status-${report.id}`);
    try {
      const result = await apiFetch(`/admin/reports/${encodeURIComponent(report.id)}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      showToast(result.message || 'Signalement mis à jour.');
      await load();
    } catch (err) { showToast(err.message || 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  async function warnUser(user, defaultMessage = '') {
    const message = await appPrompt(`Avertissement écrit à envoyer à ${user.profile?.pseudo || user.email} :`, {
      title: 'Avertissement écrit',
      defaultValue: defaultMessage,
      placeholder: 'Expliquez clairement le problème et la règle à respecter…',
      confirmLabel: 'Envoyer l’avertissement',
    });
    if (message === null) return;
    const body = message.trim();
    if (!body) { showToast('Message obligatoire.'); return; }
    setBusyId(`warn-${user.id}`);
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/warn`, { method: 'POST', body: JSON.stringify({ message: body, severity: 'warning' }) });
      showToast(result.message || 'Avertissement envoyé.');
      await load();
    } catch (err) { showToast(err.message || 'Avertissement impossible.'); }
    finally { setBusyId(''); }
  }

  async function warnFromReport(report) {
    const fallback = `Bonjour, nous avons reçu un signalement concernant votre comportement sur Voluptia. Merci de respecter les règles de consentement, de respect et de confidentialité. En cas de récidive, votre profil pourra être masqué ou suspendu.`;
    const message = await appPrompt(`Avertissement écrit pour ${report.target?.pseudo || report.targetId} :`, { title: 'Avertir depuis le signalement', defaultValue: fallback, placeholder: 'Message clair envoyé au membre…', confirmLabel: 'Envoyer et clôturer' });
    if (message === null) return;
    if (!message.trim()) { showToast('Message obligatoire.'); return; }
    await resolveReportWithAction(report.id, 'warn', message.trim());
  }

  async function submitWarningForm(event) {
    event.preventDefault();
    const user = users.find((item) => item.id === warningForm.userId || item.profileId === warningForm.userId);
    if (!user) { showToast('Sélectionnez un membre.'); return; }
    if (!warningForm.message.trim()) { showToast('Message d’avertissement obligatoire.'); return; }
    setBusyId('warning-form');
    try {
      const result = await apiFetch(`/admin/users/${encodeURIComponent(user.id)}/warn`, { method: 'POST', body: JSON.stringify(warningForm) });
      showToast(result.message || 'Avertissement envoyé.');
      setWarningForm({ userId: '', severity: 'warning', message: '', hideProfile: false, revokeSessions: false });
      await load();
    } catch (err) { showToast(err.message || 'Avertissement impossible.'); }
    finally { setBusyId(''); }
  }

  async function dismissReport(reportId) {
    try { const result = await apiFetch(`/admin/reports/${encodeURIComponent(reportId)}/dismiss`, { method: 'POST', body: JSON.stringify({}) }); showToast(result.message || 'Signalement ignoré.'); await load(); }
    catch (err) { showToast(err.message || 'Action impossible.'); }
  }

  async function purgeRetainedMedia() {
    const eligible = Number(overview?.mediaRetention?.eligibleForPurge || 0);
    const message = eligible
      ? `Supprimer définitivement ${eligible} média(s) éligible(s) ? Cette action est irréversible.`
      : 'Aucun média ne semble éligible. Lancer quand même la vérification manuelle ?';
    if (!(await appConfirm(message, { title: 'Purge des médias', danger: eligible > 0, confirmLabel: eligible ? 'Supprimer' : 'Vérifier' }))) return;
    setBusyId('media-retention-purge');
    try {
      const result = await apiFetch('/admin/media-retention/purge', { method: 'POST', body: JSON.stringify({}) });
      showToast(result.message || 'Purge manuelle terminée.');
      await load();
    } catch (err) { showToast(err.message || 'Purge impossible.'); }
    finally { setBusyId(''); }
  }

  if (!overview) return <section className="page"><LoadingScreen /></section>;

  const stats = overview.stats || {};
  const finance = overview.finance || {};
  const community = overview.community || {};
  const activity = overview.activity || {};
  const moderation = overview.moderation || {};
  const database = overview.database || {};
  const adminInfo = overview.admin || {};
  const security = overview.security || {};
  const mediaRetention = overview.mediaRetention || {};
  const topProfiles = community.topProfiles || [];
  const promoCodes = overview.promoCodes || [];
  const purchases = overview.purchases || [];
  const promoUses = overview.promoUses || [];
  const influencers = overview.influencers || [];
  const users = overview.users || [];
  const reports = overview.reports || [];
  const verificationRequests = overview.verificationRequests || [];
  const moderationWarnings = overview.moderationWarnings || [];
  const reportCategories = overview.reportCategories || REPORT_CATEGORIES_UI;
  const plans = finance.planDistribution || overview.subscriptionPlans || [];
  const codeRevenueMax = Math.max(1, ...promoCodes.map((promo) => Number(promo.revenueCents || 0)));
  const planMax = Math.max(1, ...plans.map((plan) => Number(plan.activeCount || plan.totalCount || 0)));
  const profileMax = Math.max(1, ...topProfiles.map((profile) => Number(profile.receivedHearts || 0) + Number(profile.followerCount || 0) + Number(profile.viewCount || 0)));
  const filteredUsers = users.filter((user) => {
    const haystack = normalize(`${user.email} ${user.profile?.pseudo || ''} ${user.profileId} ${user.city} ${user.type}`);
    const matchesQuery = !query || haystack.includes(normalize(query));
    const normalizedRoleFilter = normalize(roleFilter);
    const matchesRole = roleFilter === 'Tous'
      || normalize(user.role) === normalizedRoleFilter
      || normalize(user.status) === normalizedRoleFilter
      || (normalizedRoleFilter === 'notifications' && user.notificationsEnabled)
      || (normalizedRoleFilter === 'installee' && user.appInstalled)
      || (normalizedRoleFilter === 'support' && Number(user.messageCount || 0) > 0);
    return matchesQuery && matchesRole;
  });
  const filteredReports = reports.filter((report) => {
    if (reportFilter === 'Ouverts') return report.status === 'new' || report.status === 'reviewing';
    if (reportFilter === 'Urgents') return report.priority === 'urgent' && report.status !== 'resolved' && report.status !== 'dismissed';
    if (reportFilter === 'Nouveaux') return report.status === 'new';
    if (reportFilter === 'En cours') return report.status === 'reviewing';
    if (reportFilter === 'Clôturés') return report.status === 'resolved' || report.status === 'dismissed';
    return true;
  });
  const warningTargets = users.filter((user) => user.role !== 'admin');
  const normalMemberOptions = [{ value: '', label: 'Sélectionner un compte normal' }, ...users.filter((user) => user.role !== 'admin').map((user) => ({ value: user.profileId, label: `${user.profile?.pseudo || user.email} — ${user.email}` }))];
  const influencerSelectOptions = [{ value: '', label: 'Aucun influenceur' }, ...influencers.map((influencer) => ({ value: influencer.profileId, label: `${influencer.pseudo} — ${influencer.commissionRate}%` }))];
  const influencerRevenueCents = influencers.reduce((sum, influencer) => sum + Number(influencer.revenueCents || 0), 0);
  const influencerCommissionCents = influencers.reduce((sum, influencer) => sum + Number(influencer.commissionCents || 0), 0);
  const influencerNetCents = Math.max(0, influencerRevenueCents - influencerCommissionCents);
  const activeInfluencers = influencers.filter((influencer) => influencer.active).length;
  const transactions = [...purchases, ...promoUses].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const mainKpis = [
    { value: finance.revenueLabel || money(stats.promoRevenueCents), label: 'CA total', tone: 'gold', icon: '€' },
    { value: finance.netRevenueLabel || money(0), label: 'Net estimé', tone: 'green', icon: '↗' },
    { value: number(stats.users), label: 'comptes', tone: 'pink', icon: '👤' },
    { value: number(stats.activeSubscriptions), label: 'abonnés actifs', tone: 'gold', icon: '♕' },
    { value: number(moderation.openReports), label: 'signalements ouverts', tone: 'blue', icon: '!' },
    { value: percent(finance.conversionRate), label: 'conversion', tone: 'green', icon: '%' },
  ];
  const adminSections = [
    { label: 'Vue d’ensemble', summary: 'KPI, communauté, activité', badge: `${number(stats.activeSessions)} live`, icon: '⌁' },
    { label: 'Clients', summary: 'Tableau clients, app, cloche, support', badge: `${number(stats.notificationEnabledProfiles || 0)} 🔔`, icon: '◎' },
    { label: 'Membres', summary: 'Créer, filtrer, premium', badge: number(stats.users), icon: '👥' },
    { label: 'Vue membre', summary: 'Voir profils et albums privés', badge: 'admin', icon: '◉' },
    { label: 'Sécurité', summary: 'Double authentification (2FA)', badge: '🔐', icon: '🛡️' },
    { label: 'Modération', summary: 'Signalements, vérifications et blocages', badge: `${number(moderation.openReports)} • ${number(moderation.pendingVerificationRequests || 0)}`, icon: '⚑' },
    { label: 'Revenus', summary: 'CA, abonnements, achats', badge: finance.revenueLabel || money(0), icon: '€' },
    { label: 'Influenceurs', summary: 'Comptes, commissions, liens', badge: number(influencers.length), icon: '↗' },
    { label: 'Code', summary: 'Codes influenceur, CA, profits', badge: number(promoCodes.length), icon: '%' },
    { label: 'Lieux', summary: 'Commerces sur la carte', badge: number(venues.length), icon: '⌖' },
    { label: 'Système', summary: 'Render, base, conformité', badge: `${number(mediaRetention.eligibleForPurge || 0)} purge`, icon: '⚙' },
  ];
  const activeSectionMeta = adminSections.find((section) => section.label === activeSection) || adminSections[0];
  const supportClients = users.filter((user) => Number(user.messageCount || 0) > 0).length;
  const freeMembers = users.filter((user) => user.role !== 'admin' && !user.subscriptionActive).length;
  const membersWithoutApp = users.filter((user) => user.role !== 'admin' && !user.appInstalled).length;
  const adminQuickActions = [
    { icon: '!', value: number(moderation.openReports), title: moderation.openReports ? 'Modérer maintenant' : 'Modération calme', detail: 'Signalements à lire, prendre en charge ou sanctionner.', section: 'Modération', filter: 'Tous', tone: moderation.openReports ? 'danger' : 'ok' },
    { icon: '✓', value: number(moderation.pendingVerificationRequests || 0), title: 'Vérifications profil', detail: 'Photos envoyées par les membres à accepter ou refuser.', section: 'Modération', filter: 'Tous', tone: moderation.pendingVerificationRequests ? 'premium' : 'neutral' },
    { icon: '✉', value: number(supportClients), title: 'Suivi clients', detail: 'Retrouvez les clients avec échanges support.', section: 'Clients', filter: 'support', tone: supportClients ? 'focus' : 'neutral' },
    { icon: '♕', value: number(freeMembers), title: 'Membres gratuits', detail: 'Comptes à aider, convertir ou vérifier.', section: 'Membres', filter: 'gratuit', tone: freeMembers ? 'premium' : 'ok' },
    { icon: '%', value: number(activeInfluencers), title: 'Influenceurs actifs', detail: 'Comptes partenaires, commissions et codes.', section: 'Influenceurs', filter: 'Tous', tone: activeInfluencers ? 'premium' : 'neutral' },
    { icon: '↗', value: number(membersWithoutApp), title: 'Installer l’app', detail: 'Membres sans application installée.', section: 'Clients', filter: 'Tous', tone: membersWithoutApp ? 'neutral' : 'ok' },
    { icon: '✓', value: number(mediaRetention.eligibleForPurge || 0), title: 'Conformité médias', detail: 'Médias supprimés éligibles à purge.', section: 'Système', filter: 'Tous', tone: Number(mediaRetention.eligibleForPurge || 0) ? 'danger' : 'ok' },
  ];
  const clientFilters = ['Tous', 'notifications', 'installée', 'support', 'abonné', 'gratuit'];
  const memberFilters = ['Tous', 'member', 'admin', 'abonné', 'masqué', 'gratuit'];
  function openAdminSection(section, filter = 'Tous') {
    setActiveSection(section);
    setRoleFilter(filter);
    setQuery('');
  }

  return (
    <section className="page admin-page vadm admin-dashboard-v52 admin-dashboard-v58 admin-dashboard-v63 admin-dashboard-v64 admin-dashboard-v80 admin-dashboard-v136 admin-dashboard-v147">
      <div className="admin-hero-v52 glass">
        <div>
          <p className="eyebrow">Centre de contrôle Voluptia</p>
          <h2>Administration</h2>
          <p className="admin-hero-text-v136">Vue claire des priorités : modération, membres, revenus, influenceurs et sécurité.</p>
          <div className="admin-live-row">
            <span>● {number(stats.activeSessions)} en ligne</span>
            <span>{number(stats.notificationEnabledProfiles || 0)} notifications</span>
            <span>{number(stats.installedAppProfiles || 0)} apps installées</span>
            <span>{number(stats.onlineProfiles)} profils actifs</span>
            <span style={{ color: stats.openReports ? '#ff8fc5' : 'inherit' }}>{stats.openReports ? '⚠ ' : ''}{number(stats.openReports)} signalements</span>
          </div>
        </div>
        <div className="admin-money-card-v52">
          <small>Admin principal</small>
          <strong>{adminInfo.email || 'Non configuré'}</strong>
          <span>{adminInfo.configured ? 'Render configuré' : adminInfo.bootstrap ? 'Bootstrap actif' : 'À configurer'}</span>
          <span>Mode âge : {security.ageVerificationMode || 'déclaration'}</span>
        </div>
      </div>

      {secret ? (
        <article className="admin-secret-box-v58 glass panel">
          <div><p className="eyebrow">À copier maintenant</p><h3>{secret.title}</h3><p>{secret.email}</p></div>
          <code>{secret.password}</code>
          <button type="button" className="secondary-btn" onClick={() => setSecret(null)}>Masquer</button>
        </article>
      ) : null}

      <section className="admin-command-center-v80 glass" aria-label="Priorités administration">
        <div className="admin-command-copy-v80">
          <p className="eyebrow">À faire en premier</p>
          <h3>Commandes rapides</h3>
        </div>
        <div className="admin-command-actions-v80">
          {adminQuickActions.map((action) => (
            <button type="button" key={action.title} className={cx('admin-command-card-v80', action.tone)} onClick={() => openAdminSection(action.section, action.filter)}>
              <span>{action.icon}</span>
              <strong>{action.value}</strong>
              <em>{action.title}</em>
              <small>{action.detail}</small>
            </button>
          ))}
        </div>
      </section>

      <nav className="vadm-tabbar" aria-label="Sections administration">
        {adminSections.map((section) => (
          <button type="button" key={section.label} className={cx('vadm-tab', activeSection === section.label && 'active')} onClick={() => setActiveSection(section.label)}>
            <span className="vadm-tab-ic">{section.icon}</span>
            <span className="vadm-tab-copy">
              <strong>{section.label}</strong>
              <small>{section.summary}</small>
            </span>
            {section.badge ? <em className="vadm-tab-badge">{section.badge}</em> : null}
          </button>
        ))}
      </nav>

      <nav className="vadm-dock" aria-label="Sections administration (mobile)">
        {adminSections.map((section) => (
          <button type="button" key={section.label} className={cx('vadm-dock-btn', activeSection === section.label && 'active')} onClick={() => setActiveSection(section.label)} title={section.label}>
            <i>{section.icon}</i>
            <small>{section.label.replace('Vue d’ensemble', 'Accueil').replace('Vue membre', 'Profils')}</small>
          </button>
        ))}
      </nav>

      <div className="admin-section-banner-v80">
        <div>
          <strong>{activeSectionMeta.label}</strong>
          <span>{activeSectionMeta.summary}</span>
        </div>
        <button type="button" className="small-btn" onClick={load} title="Actualiser les données">↺ Actualiser</button>
      </div>

      {activeSection === 'Vue membre' ? <ViewAsMember showToast={showToast} /> : null}

      {activeSection === 'Sécurité' ? <AdminTwoFactor showToast={showToast} /> : null}

      {activeSection === 'Vue d’ensemble' ? (
        <>
          <div className="admin-kpi-grid-v52">
            {mainKpis.map((item) => <div className={cx('admin-kpi-v52', item.tone)} key={item.label}><i className="admin-kpi-icon-v136">{item.icon}</i><strong>{item.value}</strong><span>{item.label}</span></div>)}
          </div>
          <div className="admin-grid-v52 two">
            <article className="glass panel admin-panel-v52">
              <div className="panel-title-row small"><div><p className="eyebrow">Communauté</p><h3>Profils & activité</h3></div></div>
              <div className="admin-metrics-list-v52">
                <span><b>{number(stats.visibleProfiles)}</b> profils visibles</span>
                <span><b>{number(stats.verifiedProfiles)}</b> profils vérifiés</span>
                <span><b>{number(stats.hiddenProfiles)}</b> profils masqués/admin</span>
                <span><b>{number(community.followers)}</b> suivis</span>
                <span><b>{number(community.profileLikes)}</b> coups de cœur</span>
                <span><b>{number(community.profileViews)}</b> vues profil</span>
              </div>
              <div className="admin-breakdown-v52">
                {(community.typeBreakdown || []).map((item) => <span key={item.type}>{item.type}<b>{number(item.count)}</b></span>)}
              </div>
            </article>
            <article className="glass panel admin-panel-v52">
              <div className="panel-title-row small"><div><p className="eyebrow">Plateforme</p><h3>Messages, albums & médias</h3></div></div>
              <div className="admin-metrics-list-v52">
                <span><b>{number(activity.conversations)}</b> conversations</span>
                <span><b>{number(activity.messages)}</b> messages</span>
                <span><b>{number(activity.unreadMessages)}</b> messages non lus</span>
                <span><b>{number(activity.albums)}</b> albums</span>
                <span><b>{number(activity.privateAlbums)}</b> albums privés</span>
                <span><b>{number(activity.videos)}</b> vidéos</span>
              </div>
              <div className="admin-breakdown-v52">
                <span>Demandes album<b>{number(activity.albumRequests)}</b></span>
                <span>En attente<b>{number(activity.pendingAlbumRequests)}</b></span>
                <span>Acceptées<b>{number(activity.grantedAlbumRequests)}</b></span>
              </div>
            </article>
          </div>
          <div className="admin-grid-v52 two">
            <article className="glass panel admin-panel-v52">
              <div className="panel-title-row small"><div><p className="eyebrow">Top profils</p><h3>Engagement</h3></div></div>
              <div className="admin-bars-v52">
                {topProfiles.map((profile) => {
                  const score = Number(profile.receivedHearts || 0) + Number(profile.followerCount || 0) + Number(profile.viewCount || 0);
                  return <div className="admin-bar-row-v52" key={profile.id}><span>{profile.pseudo}<small>{profile.city} • {profile.type}</small></span><em><i style={{ width: `${Math.max(7, (score / profileMax) * 100)}%` }} /></em><b>{number(score)}</b></div>;
                })}
                {!topProfiles.length ? <EmptyState title="Aucune donnée d’engagement." /> : null}
              </div>
            </article>
            <article className="glass panel admin-panel-v52">
              <div className="panel-title-row small"><div><p className="eyebrow">Villes</p><h3>Répartition géographique</h3></div></div>
              <div className="admin-city-grid-v52">
                {(community.cityBreakdown || []).map((item) => <span key={item.city}>{item.city}<b>{number(item.count)}</b></span>)}
              </div>
            </article>
          </div>
        </>
      ) : null}

      {activeSection === 'Clients' ? (
        <article className="glass panel admin-panel-v52 admin-clients-panel-v68">
          <div className="panel-title-row small"><div><p className="eyebrow">Clients</p><h3>Tableau des utilisateurs</h3></div></div>
          <div className="admin-toolbar-v58">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher client, email, ville…" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option>Tous</option><option>member</option><option>admin</option><option>abonné</option><option>gratuit</option><option>notifications</option><option>installée</option><option>support</option></select>
            <span className="admin-filter-count-v72">{filteredUsers.length}/{users.length}</span>
            <button type="button" className="admin-filter-reset-v72" onClick={() => { setQuery(''); setRoleFilter('Tous'); }}>Reset</button>
          </div>
          <div className="admin-filter-chips-v80" aria-label="Filtres clients rapides">
            {clientFilters.map((filter) => (
              <button type="button" key={filter} className={cx(roleFilter === filter && 'active')} aria-pressed={roleFilter === filter} onClick={() => setRoleFilter(filter)}>{filter}</button>
            ))}
          </div>
          <div className="admin-client-cards-v80" aria-label="Clients en cartes">
            {filteredUsers.map((user) => (
              <article className="admin-client-card-v80" key={`client-card-${user.id}`}>
                <div className="admin-client-card-head-v80">
                  <Avatar profile={user.profile} />
                  <div><strong>{user.profile?.pseudo || user.profileId}</strong><span>{user.email}</span><small>{user.city || 'Ville'} • {user.type || user.role}</small></div>
                </div>
                <div className="admin-client-card-status-v80">
                  <span className={cx(user.notificationsEnabled && 'ok')}>{user.notificationsEnabled ? 'Cloche active' : 'Notifications off'}</span>
                  <span className={cx(user.appInstalled && 'ok')}>{user.appInstalled ? 'App installée' : 'Web seulement'}</span>
                  <span className={cx(user.subscriptionActive && 'ok')}>{user.subscriptionActive ? 'Premium' : user.status}</span>
                  <span>{number(user.messageCount)} message(s)</span>
                </div>
                <div className="admin-client-card-actions-v80">
                  <button type="button" className="secondary-btn" disabled={busyId === `message-${user.id}`} onClick={() => sendAdminMessage(user)}>Message</button>
                  <button type="button" className="ghost-btn" disabled={busyId === user.id} onClick={() => grantPremium(user, 30)}>Premium 30j</button>
                </div>
              </article>
            ))}
            {!filteredUsers.length ? <EmptyState title="Aucun client trouvé." /> : null}
          </div>
          <div className="admin-client-table-v68" role="table" aria-label="Tableau clients">
            <div className="admin-client-row-v68 header" role="row">
              <span>Client</span><span>Notifications</span><span>Application</span><span>Abonnement</span><span>Messages</span><span>Actions</span>
            </div>
            {filteredUsers.map((user) => (
              <div className="admin-client-row-v68" role="row" key={`client-${user.id}`}>
                <span className="admin-client-main-v68"><Avatar profile={user.profile} /><em><strong>{user.profile?.pseudo || user.profileId}</strong><small>{user.email}<br />{user.city || 'Ville'} • {user.type || user.role}</small></em></span>
                <span><i className={cx('admin-status-dot-v68', user.notificationsEnabled && 'ok')}>{user.notificationsEnabled ? '🔔' : '🔕'}</i><small>{user.clientStatus?.notificationPermission || 'default'}</small></span>
                <span><i className={cx('admin-status-dot-v68', user.appInstalled && 'ok')}>{user.appInstalled ? '📲' : '🌐'}</i><small>{user.clientStatus?.lastClientSeenAt ? formatDate(user.clientStatus.lastClientSeenAt) : 'jamais'}</small></span>
                <span><i className={cx('admin-status-dot-v68', user.subscriptionActive && 'ok')}>{user.subscriptionActive ? '💎' : '○'}</i><small>{user.subscription?.plan?.label || user.status}</small></span>
                <span><b>{number(user.messageCount)}</b><small>message(s)</small></span>
                <span className="admin-client-actions-v68"><button type="button" className="secondary-btn" disabled={busyId === `message-${user.id}`} onClick={() => sendAdminMessage(user)}>Message</button><button type="button" className="ghost-btn" disabled={busyId === user.id} onClick={() => grantPremium(user, 30)}>Premium 30j</button></span>
              </div>
            ))}
            {!filteredUsers.length ? <EmptyState title="Aucun client trouvé." /> : null}
          </div>
        </article>
      ) : null}

      {activeSection === 'Membres' ? (
        <div className="admin-grid-v52 admin-users-layout-v58">
          <form className="glass profile-edit-form admin-panel-v52 admin-create-user-v64" onSubmit={createUser}>
            <div className="panel-title-row small"><div><p className="eyebrow">Créer</p><h3>Nouveau compte</h3><p>Vide = mot de passe fort généré.</p></div></div>
            <div className="admin-form-block-v64">
              <div className="admin-form-heading-v64"><strong>Identité</strong><span>Rôle, pseudo public et adresse de connexion</span></div>
              <div className="form-grid three">
                <SelectField label="Rôle" value={userForm.role} options={['admin', 'member']} onChange={(value) => setUserForm({ ...userForm, role: value, type: value === 'admin' ? 'Admin' : 'Homme', hidden: value === 'admin' ? true : userForm.hidden, verified: value === 'admin' ? true : userForm.verified })} />
                <Field label="Pseudo" value={userForm.pseudo} onChange={(value) => setUserForm({ ...userForm, pseudo: value })} />
                <Field label="Email" type="email" value={userForm.email} onChange={(value) => setUserForm({ ...userForm, email: value })} placeholder="admin@domaine.fr" />
              </div>
            </div>
            <div className="admin-form-block-v64">
              <div className="admin-form-heading-v64"><strong>Profil</strong><span>Informations visibles et ville principale</span></div>
              <div className="form-grid three">
                <Field label="Mot de passe" type="password" value={userForm.password} onChange={(value) => setUserForm({ ...userForm, password: value })} placeholder="Vide = généré" />
                <Field label="Type profil" value={userForm.type} onChange={(value) => setUserForm({ ...userForm, type: value })} />
                <CityField label="Ville" value={userForm.city} onChange={(value) => setUserForm({ ...userForm, city: value })} placeholder="Paris, Lyon, Marseille…" compact />
              </div>
            </div>
            <div className="admin-form-block-v64">
              <div className="admin-form-heading-v64"><strong>Accès</strong><span>Âge, abonnement et état du profil</span></div>
              <div className="form-grid three">
                <Field label="Âge" type="number" value={userForm.age} onChange={(value) => setUserForm({ ...userForm, age: value })} />
                <Field label="Jours premium" type="number" value={userForm.premiumDays} onChange={(value) => setUserForm({ ...userForm, premiumDays: value })} />
                <SelectField label="Formule" value={userForm.planId} options={(overview.subscriptionPlans || []).map((plan) => plan.id)} onChange={(value) => setUserForm({ ...userForm, planId: value })} />
              </div>
              <div className="admin-toggle-row-v58 admin-toggle-row-v64">
                <label><input type="checkbox" checked={Boolean(userForm.hidden)} disabled={userForm.role === 'admin'} onChange={(e) => setUserForm({ ...userForm, hidden: e.target.checked })} /> Profil masqué</label>
                <label><input type="checkbox" checked={Boolean(userForm.verified)} onChange={(e) => setUserForm({ ...userForm, verified: e.target.checked })} /> Profil vérifié</label>
                <label><input type="checkbox" checked={Boolean(userForm.grantPremium)} onChange={(e) => setUserForm({ ...userForm, grantPremium: e.target.checked })} /> Donner premium</label>
              </div>
            </div>
            <button type="submit" className="primary-btn full" disabled={busyId === 'create-user'}>{userForm.role === 'admin' ? 'Créer le compte admin' : 'Créer le compte utilisateur'}</button>
          </form>

          <article className="glass panel admin-panel-v52 admin-users-panel-v58">
            <div className="panel-title-row small"><div><p className="eyebrow">Gestion</p><h3>Comptes</h3><p>Recherche, rôle, premium et sessions.</p></div></div>
            <div className="admin-toolbar-v58">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option>Tous</option><option>admin</option><option>member</option><option>abonné</option><option>masqué</option><option>gratuit</option></select>
              <span className="admin-filter-count-v72">{filteredUsers.length}/{users.length}</span>
              <button type="button" className="admin-filter-reset-v72" onClick={() => { setQuery(''); setRoleFilter('Tous'); }}>Reset</button>
            </div>
            <div className="admin-filter-chips-v80" aria-label="Filtres membres rapides">
              {memberFilters.map((filter) => (
                <button type="button" key={filter} className={cx(roleFilter === filter && 'active')} aria-pressed={roleFilter === filter} onClick={() => setRoleFilter(filter)}>{filter}</button>
              ))}
            </div>
            <div className="admin-user-list-v58">
              {filteredUsers.map((user) => (
                <div className="admin-user-card-v58" key={user.id}>
                  <div className="admin-user-main-v58"><Avatar profile={user.profile} /><div><strong>{user.profile?.pseudo || user.profileId}</strong><p>{user.email}</p><small>{user.city || 'Ville'} • {user.type || 'Profil'} • {formatDate(user.createdAt)}</small><button type="button" className="admin-user-id-v151" title="Copier l’ID utilisateur" onClick={() => copyProfileId(user.profileId)}>ID : {user.profileId} ⧉</button></div></div>
                  <div className="admin-user-badges-v58"><span>{user.role}</span><span className={cx(user.suspended && 'admin-badge-suspended-v151')}>{user.suspended ? 'suspendu' : user.status}</span>{user.verified ? <span>vérifié</span> : null}{user.isInfluencer ? <span>influenceur</span> : null}{user.sessionCount ? <span>{user.sessionCount} session(s)</span> : null}</div>
                  <div className="admin-user-actions-v58 admin-user-actions-v64">
                    <span className="admin-action-group-v64">
                      <button type="button" className="secondary-btn" disabled={busyId === user.id || !user.canChangeRole} onClick={() => updateUser(user, { role: user.role === 'admin' ? 'member' : 'admin' })}>{user.role === 'admin' ? 'Membre' : 'Admin'}</button>
                      <button type="button" className="secondary-btn" disabled={busyId === user.id || user.role === 'admin'} onClick={() => updateUser(user, { hidden: !user.hidden })}>{user.hidden ? 'Afficher' : 'Masquer'}</button>
                      <button type="button" className="secondary-btn" disabled={busyId === user.id} onClick={() => updateUser(user, { verified: !user.verified })}>{user.verified ? 'Dévérifier' : 'Vérifier'}</button>
                    </span>
                    <span className="admin-action-group-v64">
                      {user.subscription ? <button type="button" className="secondary-btn" disabled={busyId === user.id} onClick={() => revokePremium(user)}>Retirer premium</button> : <button type="button" className="secondary-btn" disabled={busyId === user.id} onClick={() => grantPremium(user, 30)}>Premium 30j</button>}
                      <button type="button" className="secondary-btn" disabled={busyId === user.id} onClick={() => resetPassword(user)}>Mot de passe</button>
                      <button type="button" className="secondary-btn danger-soft" disabled={busyId === `warn-${user.id}` || user.role === 'admin'} onClick={() => warnUser(user)}>Avertir</button>
                      <button type="button" className="secondary-btn danger-soft" disabled={busyId === user.id || !user.canDelete} onClick={() => revokeSessions(user)}>Sessions</button>
                      {user.role !== 'admin' && !user.isInfluencer ? <button type="button" className="secondary-btn" disabled={busyId === user.id} onClick={() => promoteToInfluencer(user)}>Influenceur</button> : null}
                      {user.role !== 'admin' ? <button type="button" className={cx('secondary-btn', user.suspended ? '' : 'danger-soft')} disabled={busyId === user.id} onClick={() => suspendUser(user)}>{user.suspended ? 'Réactiver' : 'Suspendre'}</button> : null}
                      {user.role !== 'admin' ? <button type="button" className="secondary-btn admin-btn-danger-v151" disabled={busyId === user.id} onClick={() => deleteUser(user)}>Supprimer</button> : null}
                    </span>
                  </div>
                </div>
              ))}
              {!filteredUsers.length ? <EmptyState title="Aucun compte trouvé." /> : null}
            </div>
          </article>
        </div>
      ) : null}

      {activeSection === 'Modération' ? (
        <div className="admin-grid-v52 two admin-moderation-v132">
          <article className="glass panel admin-panel-v52 admin-reports-panel-v132">
            <div className="panel-title-row small">
              <div>
                <p className="eyebrow">Boîte de réception</p>
                <h3>Signalements</h3>
                <p>Chaque signalement arrive ici avec priorité, profil signalé, déclarant et actions rapides.</p>
              </div>
            </div>
            <div className="admin-kpi-grid-v52 compact">
              <div className="admin-kpi-v52 pink"><strong>{number(moderation.openReports)}</strong><span>ouverts</span></div>
              <div className="admin-kpi-v52 blue"><strong>{number(moderation.urgentReports)}</strong><span>urgents</span></div>
              <div className="admin-kpi-v52 green"><strong>{number(moderation.warnings || moderation.moderationWarnings)}</strong><span>avertissements</span></div>
              <div className="admin-kpi-v52"><strong>{number(moderation.blockedProfiles)}</strong><span>blocages</span></div>
            </div>
            <div className="admin-filter-chips-v80 moderation-filters-v132" aria-label="Filtres signalements">
              {['Ouverts', 'Urgents', 'Nouveaux', 'En cours', 'Clôturés', 'Tous'].map((filter) => (
                <button type="button" key={filter} className={cx(reportFilter === filter && 'active')} onClick={() => setReportFilter(filter)}>{filter}</button>
              ))}
            </div>
            <div className="admin-report-list-v132">
              {filteredReports.map((report) => (
                <article className={cx('admin-report-card-v132', report.priority === 'urgent' && 'urgent', report.status === 'reviewing' && 'reviewing')} key={report.id}>
                  <div className="admin-report-head-v132">
                    <span className={cx('admin-report-priority-v132', report.priority)}>{report.priority || 'normale'}</span>
                    <strong>{report.category || 'Signalement'}</strong>
                    <small>{formatDate(report.createdAt)} • {report.status === 'new' ? 'nouveau' : report.status === 'reviewing' ? 'en cours' : report.status}</small>
                  </div>
                  <div className="admin-report-people-v132">
                    <span><b>Signalé</b>{report.target?.pseudo || report.targetId}</span>
                    <span><b>Par</b>{report.reporter?.pseudo || report.reporterId}</span>
                    {report.assignedToProfile ? <span><b>Pris par</b>{report.assignedToProfile.pseudo}</span> : null}
                  </div>
                  <p className="admin-report-reason-v132">{report.reason}</p>
                  {report.source ? <small className="admin-report-source-v132">Source : {report.source}{report.context ? ` • ${report.context}` : ''}</small> : null}
                  {report.warnings?.length ? <small className="admin-report-source-v132">Avertissements liés : {report.warnings.length}</small> : null}
                  {report.status === 'new' || report.status === 'reviewing' ? (
                    <div className="admin-action-row-v58 admin-report-actions-v132">
                      {report.status === 'new' ? <button type="button" className="secondary-btn" disabled={busyId === `report-status-${report.id}`} onClick={() => setReportStatus(report, 'reviewing')}>Prendre en charge</button> : null}
                      <button type="button" className="secondary-btn" onClick={() => resolveReportWithAction(report.id, 'resolve')}>Clôturer simple</button>
                      <button type="button" className="secondary-btn warning" onClick={() => warnFromReport(report)}>Avertissement écrit</button>
                      <button type="button" className="secondary-btn" onClick={() => resolveReportWithAction(report.id, 'hide_profile')}>Masquer profil</button>
                      <button type="button" className="secondary-btn" style={{ color: 'var(--color-text-danger)' }} onClick={async () => { if (await appConfirm('Suspendre le compte et envoyer un dernier avertissement ?', { title: 'Suspendre le compte', danger: true, confirmLabel: 'Suspendre' })) resolveReportWithAction(report.id, 'ban'); }}>Suspendre</button>
                      <button type="button" className="secondary-btn" onClick={() => dismissReport(report.id)}>Ignorer</button>
                    </div>
                  ) : <span className="admin-pill-v52">Traité : {report.resolvedAction || report.status}</span>}
                </article>
              ))}
              {!filteredReports.length ? <EmptyState title="Aucun signalement dans ce filtre." subtitle="Les nouveaux signalements apparaîtront automatiquement ici." /> : null}
            </div>
          </article>
          <div className="admin-moderation-side-v132">
            <article className="glass panel admin-panel-v52 admin-warning-composer-v132">
              <div className="panel-title-row small"><div><p className="eyebrow">Avertissement écrit</p><h3>Envoyer à un membre</h3><p>Le membre reçoit une notification officielle dans son compte.</p></div></div>
              <form onSubmit={submitWarningForm} className="admin-warning-form-v132">
                <label className="field"><span>Membre</span><select value={warningForm.userId} onChange={(e) => setWarningForm({ ...warningForm, userId: e.target.value })}><option value="">Choisir…</option>{warningTargets.map((user) => <option key={user.id} value={user.id}>{user.profile?.pseudo || user.email} — {user.email}</option>)}</select></label>
                <SelectField label="Niveau" value={warningForm.severity} options={[{ value: 'info', label: 'Rappel' }, { value: 'warning', label: 'Avertissement' }, { value: 'final', label: 'Dernier avertissement' }]} onChange={(value) => setWarningForm({ ...warningForm, severity: value })} />
                <TextareaField label="Message écrit" value={warningForm.message} onChange={(value) => setWarningForm({ ...warningForm, message: value })} />
                <div className="admin-toggle-row-v58">
                  <label><input type="checkbox" checked={warningForm.hideProfile} onChange={(e) => setWarningForm({ ...warningForm, hideProfile: e.target.checked })} /> Masquer aussi le profil</label>
                  <label><input type="checkbox" checked={warningForm.revokeSessions} onChange={(e) => setWarningForm({ ...warningForm, revokeSessions: e.target.checked })} /> Fermer ses sessions</label>
                </div>
                <button type="submit" className="primary-btn full" disabled={busyId === 'warning-form'}>Envoyer l’avertissement</button>
              </form>
            </article>

<article className="glass panel admin-panel-v52 admin-verification-panel-v146">
  <div className="panel-title-row small"><div><p className="eyebrow">Vérification profil</p><h3>Demandes membres</h3><p>Le membre envoie une photo. Vous acceptez ou refusez. Si accepté, le badge vérifié apparaît sur son profil.</p></div></div>
  <div className="admin-kpi-grid-v52 compact">
    <div className="admin-kpi-v52 pink"><strong>{number(verificationRequests.filter((item) => item.status === 'pending').length)}</strong><span>en attente</span></div>
    <div className="admin-kpi-v52 green"><strong>{number(verificationRequests.filter((item) => item.status === 'approved').length)}</strong><span>acceptées</span></div>
    <div className="admin-kpi-v52 blue"><strong>{number(verificationRequests.filter((item) => item.status === 'rejected').length)}</strong><span>refusées</span></div>
  </div>
  <div className="admin-verification-list-v146">
    {verificationRequests.slice(0, 12).map((request) => (
      <article className={cx('admin-verification-card-v146', request.status)} key={request.id}>
        <div className="admin-verification-top-v146">
          <div>
            <strong>{request.profile?.pseudo || request.pseudoSnapshot || request.profileId}</strong>
            <p>{request.profile?.category || request.categorySnapshot || 'Profil'} • {request.profile?.city || 'Ville non renseignée'}</p>
            <small>{formatDate(request.submittedAt)} • {request.status === 'pending' ? 'en attente' : request.status === 'approved' ? 'acceptée' : 'refusée'}</small>
          </div>
          {request.proofImageUrl ? <img src={request.proofImageUrl} alt={`Preuve ${request.profile?.pseudo || request.profileId}`} /> : null}
        </div>
        {request.note ? <p className="admin-report-reason-v132">Note membre : {request.note}</p> : null}
        {request.reason ? <p className="admin-report-source-v132">Dernier motif : {request.reason}</p> : null}
        {request.status === 'pending' ? (
          <div className="admin-action-row-v58 admin-report-actions-v132">
            <button type="button" className="secondary-btn" disabled={busyId === `verification-${request.id}`} onClick={() => approveVerificationRequest(request)}>Accepter</button>
            <button type="button" className="secondary-btn warning" disabled={busyId === `verification-${request.id}`} onClick={() => rejectVerificationRequest(request)}>Refuser</button>
          </div>
        ) : <span className="admin-pill-v52">{request.status === 'approved' ? 'Badge actif' : 'Peut renvoyer une photo'}</span>}
      </article>
    ))}
    {!verificationRequests.length ? <EmptyState title="Aucune demande de vérification." detail="Les photos envoyées par les membres apparaîtront ici." /> : null}
  </div>
</article>

<article className="glass panel admin-panel-v52">
  <div className="panel-title-row small"><div><p className="eyebrow">Historique</p><h3>Derniers avertissements</h3></div></div>
              <div className="admin-warning-list-v132">
                {moderationWarnings.slice(0, 8).map((warning) => (
                  <div className="admin-warning-row-v132" key={warning.id}>
                    <strong>{warning.profile?.pseudo || warning.profileId}</strong>
                    <p>{warning.message}</p>
                    <small>{warning.severity} • {formatDate(warning.createdAt)}</small>
                  </div>
                ))}
                {!moderationWarnings.length ? <EmptyState title="Aucun avertissement envoyé." /> : null}
              </div>
            </article>
            <article className="glass panel admin-panel-v52">
              <div className="panel-title-row small"><div><p className="eyebrow">Sécurité</p><h3>Indicateurs</h3></div></div>
              <div className="admin-metrics-list-v52">
                <span><b>{number(stats.ageVerifications)}</b> vérifications d’âge</span>
                <span><b>{number(stats.legalAcceptances)}</b> acceptations légales</span>
                <span><b>{number(activity.unreadNotifications)}</b> notifications non lues</span>
                <span><b>{number(activity.pendingAlbumRequests)}</b> demandes d’album en attente</span>
                <span><b>{number(moderation.pendingVerificationRequests || 0)}</b> vérifications profil en attente</span>
                <span><b>{number(community.blockedProfiles)}</b> blocages utilisateur</span>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {activeSection === 'Revenus' ? (
        <div className="admin-grid-v52 two">
          <article className="glass panel admin-panel-v52 admin-money-detail-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Finances</p><h3>Revenus</h3></div></div>
            <div className="admin-kpi-grid-v52 compact">
              <div className="admin-kpi-v52 gold"><strong>{finance.revenueLabel}</strong><span>CA encaissé / suivi</span></div>
              <div className="admin-kpi-v52 green"><strong>{finance.netRevenueLabel}</strong><span>Net estimé</span></div>
              <div className="admin-kpi-v52 pink"><strong>{finance.commissionLabel}</strong><span>Commissions</span></div>
              <div className="admin-kpi-v52 blue"><strong>{finance.averageOrderLabel}</strong><span>Panier moyen</span></div>
            </div>
            <div className="admin-metrics-list-v52">
              <span><b>{number(finance.purchaseCount)}</b> achats enregistrés</span>
              <span><b>{number(finance.paidPurchaseCount)}</b> paiements payants</span>
              <span><b>{number(finance.freeActivationCount)}</b> activations gratuites</span>
              <span><b>{finance.expectedActiveRevenueLabel}</b> valeur abonnements actifs</span>
            </div>
          </article>
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Formules</p><h3>Abonnements par formule</h3></div></div>
            <div className="admin-bars-v52">
              {plans.map((plan) => <div className="admin-bar-row-v52" key={plan.id}><span>{plan.label || plan.id}<small>{money(plan.priceCents)} • CA {plan.revenueLabel || money(plan.revenueCents)}</small></span><em><i style={{ width: `${Math.max(7, (Number(plan.activeCount || plan.totalCount || 0) / planMax) * 100)}%` }} /></em><b>{number(plan.activeCount)} actif(s)</b></div>)}
            </div>
          </article>
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Codes</p><h3>Top CA</h3></div></div>
            <div className="admin-bars-v52">
              {promoCodes.map((promo) => <div className="admin-bar-row-v52" key={promo.id}><span>{promo.code}<small>{promo.influencerName || 'Sans influenceur'} • {promo.useCount} utilisation(s)</small></span><em><i style={{ width: `${Math.max(7, (Number(promo.revenueCents || 0) / codeRevenueMax) * 100)}%` }} /></em><b>{promo.revenueLabel}</b></div>)}
              {!promoCodes.length ? <EmptyState title="Aucun code promo." /> : null}
            </div>
          </article>
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small">
              <div><p className="eyebrow">Transactions</p><h3>Récentes</h3></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="secondary-btn" onClick={() => exportCsv('purchases')}>Export achats</button>
                <button type="button" className="secondary-btn" onClick={() => exportCsv('users')}>Export membres</button>
              </div>
            </div>
            {transactions.slice(0, 12).map((purchase, index) => <div className="admin-list-row-v52" key={`${purchase.id || purchase.code}-${index}`}><div><strong>{purchase.profile?.pseudo || 'Profil'}</strong><p>{purchase.code ? `Code ${purchase.code}` : 'Paiement'} • {purchase.plan?.label || purchase.planId || 'Formule'} • commission {purchase.commissionLabel || money(purchase.commissionCents)}</p></div><span>{purchase.amountLabel || money(purchase.amountCents)}<small>{formatDate(purchase.createdAt)}</small></span></div>)}
            {!transactions.length ? <EmptyState title="Aucune transaction pour l’instant." /> : null}
          </article>
        </div>
      ) : null}

      {activeSection === 'Influenceurs' ? (
        <div className="admin-influencer-v135">
          <div className="admin-kpi-grid-v52 admin-code-kpis-v135">
            <div className="admin-kpi-v52 pink"><strong>{number(influencers.length)}</strong><span>influenceurs</span></div>
            <div className="admin-kpi-v52 gold"><strong>{number(activeInfluencers)}</strong><span>actifs</span></div>
            <div className="admin-kpi-v52 green"><strong>{money(influencerRevenueCents)}</strong><span>CA généré</span></div>
            <div className="admin-kpi-v52 blue"><strong>{money(influencerCommissionCents)}</strong><span>à reverser</span></div>
          </div>

          <div className="admin-grid-v52 two">
            <form className="glass profile-edit-form admin-panel-v52" onSubmit={createInfluencer}>
              <div className="panel-title-row small"><div><p className="eyebrow">Ajouter</p><h3>Compte influenceur</h3><p>Vous choisissez un compte normal existant, puis vous définissez sa commission par défaut.</p></div></div>
              <SelectField label="Compte normal" value={influencerForm.profileId} options={normalMemberOptions} onChange={(value) => {
                const user = users.find((item) => item.profileId === value);
                setInfluencerForm({ ...influencerForm, profileId: value, displayName: user?.profile?.pseudo || '', email: user?.email || '' });
              }} />
              <div className="form-grid two">
                <Field label="Nom public influenceur" value={influencerForm.displayName} onChange={(value) => setInfluencerForm({ ...influencerForm, displayName: value })} placeholder="Ex. Cisco" />
                <Field label="Email paiement/contact" type="email" value={influencerForm.email} onChange={(value) => setInfluencerForm({ ...influencerForm, email: value })} />
              </div>
              <Field label="Commission par défaut %" type="number" value={influencerForm.commissionRate} onChange={(value) => setInfluencerForm({ ...influencerForm, commissionRate: value })} />
              <label>Notes internes
                <textarea value={influencerForm.notes} onChange={(e) => setInfluencerForm({ ...influencerForm, notes: e.target.value })} placeholder="RIB reçu, contrat, réseau social, conditions particulières…" rows={3} maxLength={400} />
              </label>
              <button type="submit" className="primary-btn full" disabled={busyId === 'create-influencer'}>{busyId === 'create-influencer' ? 'Ajout…' : 'Ajouter comme influenceur'}</button>
            </form>

            <article className="glass panel admin-panel-v52">
              <div className="panel-title-row small"><div><p className="eyebrow">Résumé</p><h3>Commissions</h3></div></div>
              <div className="admin-metrics-list-v52">
                <span><b>{money(influencerRevenueCents)}</b> CA avec codes influenceur</span>
                <span><b>{money(influencerCommissionCents)}</b> commissions à reverser</span>
                <span><b>{money(influencerNetCents)}</b> profit net estimé</span>
                <span><b>{number(promoCodes.filter((promo) => promo.influencerProfileId).length)}</b> codes rattachés</span>
              </div>
              <p className="hint">Le pourcentage peut être changé par influenceur ou directement sur chaque code.</p>
            </article>
          </div>

          <article className="glass panel admin-panel-v52 admin-influencer-table-v135">
            <div className="panel-title-row small"><div><p className="eyebrow">Tableau</p><h3>Tous les influenceurs</h3></div></div>
            {influencers.map((influencer) => (
              <div className="admin-list-row-v52 influencer" key={influencer.profileId}>
                <div className="admin-influencer-main-v135">
                  <Avatar profile={influencer.profile} />
                  <div>
                    <strong>{influencer.pseudo}</strong>
                    <p>{influencer.email || 'Email non renseigné'} • {influencer.codesCount} code(s) • {influencer.useCount} abonnement(s)</p>
                    <small>CA {influencer.revenueLabel} • commission {influencer.commissionLabel} • net {influencer.netRevenueLabel}</small>
                  </div>
                </div>
                <div className="admin-influencer-controls-v135">
                  <label className="mini-field-v135">%
                    <input type="number" value={influencer.commissionRate} onChange={(e) => updateInfluencer(influencer, { commissionRate: Number(e.target.value || 0), syncCodes: false })} />
                  </label>
                  <button type="button" className="secondary-btn" disabled={busyId === `influencer-${influencer.profileId}`} onClick={() => updateInfluencer(influencer, { active: !influencer.active })}>{influencer.active ? 'Désactiver' : 'Activer'}</button>
                  <button type="button" className="secondary-btn" onClick={() => updateInfluencer(influencer, { commissionRate: influencer.commissionRate, syncCodes: true })}>Sync codes</button>
                  <button type="button" className="secondary-btn" onClick={() => prepareCodeForInfluencer(influencer)}>Créer code</button>
                </div>
              </div>
            ))}
            {!influencers.length ? <EmptyState title="Aucun influenceur." detail="Ajoutez un compte normal comme influenceur pour suivre ses codes et ses commissions." /> : null}
          </article>
        </div>
      ) : null}

      {activeSection === 'Code' ? (
        <>
          <div className="admin-kpi-grid-v52 admin-code-kpis-v135">
            <div className="admin-kpi-v52 gold"><strong>{money(influencerRevenueCents)}</strong><span>CA codes influenceur</span></div>
            <div className="admin-kpi-v52 blue"><strong>{money(influencerCommissionCents)}</strong><span>commissions</span></div>
            <div className="admin-kpi-v52 green"><strong>{money(influencerNetCents)}</strong><span>profit net estimé</span></div>
            <div className="admin-kpi-v52 pink"><strong>{number(promoCodes.filter((promo) => promo.influencerProfileId).length)}</strong><span>codes influenceur</span></div>
          </div>
        <div className="admin-grid-v52 two">
          {editPromo ? (
            <form className="glass profile-edit-form admin-panel-v52 admin-create-promo-v64" onSubmit={updatePromo}>
              <div className="panel-title-row small"><div><p className="eyebrow">Modifier</p><h3>{editPromo.code}</h3></div><button type="button" className="ghost-btn" onClick={() => setEditPromo(null)}>Annuler</button></div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Valeur</strong><span>{editPromo.type === 'free_month' ? 'Jours offerts' : 'Réduction %'}</span></div>
                <div className="form-grid two">
                  {editPromo.type === 'free_month'
                    ? <Field label="Jours gratuits" type="number" value={editPromo.freeDays} onChange={(v) => setEditPromo({ ...editPromo, freeDays: v })} />
                    : <Field label="Réduction %" type="number" value={editPromo.discountPercent} onChange={(v) => setEditPromo({ ...editPromo, discountPercent: v })} />}
                  <Field label="Commission %" type="number" value={editPromo.commissionRate || 0} onChange={(v) => setEditPromo({ ...editPromo, commissionRate: v })} />
                </div>
              </div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Limites</strong><span>Par profil et total</span></div>
                <div className="form-grid two">
                  <Field label="Utilisations / profil" type="number" value={editPromo.maxUsesPerProfile || 1} onChange={(v) => setEditPromo({ ...editPromo, maxUsesPerProfile: v })} />
                  <Field label="Limite totale (vide = illimité)" type="number" value={editPromo.maxUsesTotal || ''} onChange={(v) => setEditPromo({ ...editPromo, maxUsesTotal: v })} placeholder="ex : 100" />
                </div>
              </div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Validité</strong><span>Dates optionnelles</span></div>
                <div className="form-grid two">
                  <Field label="Valide à partir de" type="date" value={editPromo.validFrom ? editPromo.validFrom.slice(0, 10) : ''} onChange={(v) => setEditPromo({ ...editPromo, validFrom: v })} />
                  <Field label="Expire le" type="date" value={editPromo.validUntil ? editPromo.validUntil.slice(0, 10) : ''} onChange={(v) => setEditPromo({ ...editPromo, validUntil: v })} />
                </div>
              </div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Influenceur</strong><span>Rattachement et contact</span></div>
                <div className="form-grid three">
                  <SelectField label="Influenceur" value={editPromo.influencerProfileId || ''} options={influencerSelectOptions} onChange={(value) => {
                    const influencer = influencers.find((item) => item.profileId === value);
                    setEditPromo({ ...editPromo, influencerProfileId: value, influencerName: influencer?.pseudo || editPromo.influencerName || '', influencerEmail: influencer?.email || editPromo.influencerEmail || '', commissionRate: influencer?.commissionRate ?? editPromo.commissionRate });
                  }} />
                  <Field label="Nom influenceur" value={editPromo.influencerName || ''} onChange={(v) => setEditPromo({ ...editPromo, influencerName: v })} />
                  <Field label="Email influenceur" type="email" value={editPromo.influencerEmail || ''} onChange={(v) => setEditPromo({ ...editPromo, influencerEmail: v })} />
                </div>
              </div>
              <button type="submit" className="primary-btn full">Enregistrer les modifications</button>
            </form>
          ) : (
            <form className="glass profile-edit-form admin-panel-v52 admin-create-promo-v64" onSubmit={createPromo}>
              <div className="panel-title-row small"><div><p className="eyebrow">Créer</p><h3>Code promo</h3></div></div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Offre</strong><span>Code, type et valeur commerciale</span></div>
                <div className="form-grid three">
                  <Field label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="EXEMPLE20" />
                  <SelectField label="Type" value={form.type} options={['percent', 'free_month']} onChange={(value) => setForm({ ...form, type: value, maxUsesPerProfile: value === 'free_month' ? 1 : form.maxUsesPerProfile })} />
                  {form.type === 'free_month'
                    ? <Field label="Jours gratuits" type="number" value={form.freeDays} onChange={(value) => setForm({ ...form, freeDays: value })} />
                    : <Field label="Réduction %" type="number" value={form.discountPercent} onChange={(value) => setForm({ ...form, discountPercent: value })} />}
                </div>
              </div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Règles</strong><span>Limites et commission</span></div>
                <div className="form-grid three">
                  <Field label="Utilisations / profil" type="number" value={form.maxUsesPerProfile} onChange={(value) => setForm({ ...form, maxUsesPerProfile: value })} />
                  <Field label="Limite totale (vide = illimité)" type="number" value={form.maxUsesTotal} onChange={(value) => setForm({ ...form, maxUsesTotal: value })} placeholder="ex : 100" />
                  <Field label="Commission %" type="number" value={form.commissionRate} onChange={(value) => setForm({ ...form, commissionRate: value })} />
                </div>
              </div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Validité</strong><span>Dates optionnelles (offre flash, lancement…)</span></div>
                <div className="form-grid two">
                  <Field label="Valide à partir de" type="date" value={form.validFrom} onChange={(value) => setForm({ ...form, validFrom: value })} />
                  <Field label="Expire le" type="date" value={form.validUntil} onChange={(value) => setForm({ ...form, validUntil: value })} />
                </div>
              </div>
              <div className="admin-form-block-v64">
                <div className="admin-form-heading-v64"><strong>Influenceur</strong><span>Optionnel — suivi de lien et commission</span></div>
                <div className="form-grid three">
                  <SelectField label="Influenceur" value={form.influencerProfileId} options={influencerSelectOptions} onChange={(value) => {
                    const influencer = influencers.find((item) => item.profileId === value);
                    setForm({ ...form, influencerProfileId: value, influencerName: influencer?.pseudo || '', influencerEmail: influencer?.email || '', commissionRate: influencer?.commissionRate ?? form.commissionRate });
                  }} />
                  <Field label="Nom influenceur" value={form.influencerName} onChange={(value) => setForm({ ...form, influencerName: value })} />
                  <Field label="Email influenceur" type="email" value={form.influencerEmail} onChange={(value) => setForm({ ...form, influencerEmail: value })} />
                </div>
              </div>
              <p className="hint">Réduction max 90% pour les codes "percent". Pour 100% gratuit, choisissez "free_month".</p>
              <button type="submit" className="primary-btn full">Créer le code</button>
            </form>
          )}
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small">
              <div><p className="eyebrow">Codes</p><h3>Suivi</h3></div>
              <button type="button" className="secondary-btn" onClick={() => exportCsv('promo')} title="Télécharger CSV">Export CSV</button>
            </div>
            {promoCodes.map((p) => (
              <div className="admin-list-row-v52 promo" key={p.id}>
                <div>
                  <strong>{p.code}</strong>
                  {p.expired && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-danger)' }}>Expiré</span>}
                  {p.notStarted && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-warning)' }}>Pas encore actif</span>}
                  {p.globalLimitReached && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-warning)' }}>Limite atteinte</span>}
                  <p>
                    {p.active ? 'Actif' : 'Désactivé'} • {p.type === 'free_month' ? `${p.freeDays || 30} jours gratuits` : `${p.discountPercent}% de réduction`}
                    {p.maxUsesTotal ? ` • ${p.useCount}/${p.maxUsesTotal} utilisations` : ` • ${p.useCount} utilisation(s)`}
                    {p.validUntil ? ` • Expire ${new Date(p.validUntil).toLocaleDateString('fr-FR')}` : ''}
                    {` • CA ${p.revenueLabel} • commission ${p.commissionLabel} • profit ${money(Math.max(0, Number(p.revenueCents || 0) - Number(p.commissionCents || 0)))}`}
                  </p>
                  <small>{p.influencerLink ? `${window.location.origin}${p.influencerLink}` : 'Sans lien influenceur'}</small>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="secondary-btn" onClick={() => togglePromo(p.code)}>{p.active ? 'Désactiver' : 'Réactiver'}</button>
                  <button type="button" className="secondary-btn" onClick={() => setEditPromo(p)}>Modifier</button>
                  {p.useCount === 0 && <button type="button" className="secondary-btn" style={{ color: 'var(--color-text-danger)' }} onClick={() => deletePromo(p.code)}>Supprimer</button>}
                </div>
              </div>
            ))}
            {!promoCodes.length ? <EmptyState title="Aucun code promo." /> : null}
          </article>
        </div>
        </>
      ) : null}

      {activeSection === 'Lieux' ? (
        <div className="admin-grid-v52 two">
          <form className="glass profile-edit-form admin-panel-v52" onSubmit={createVenue}>
            <div className="panel-title-row small"><div><p className="eyebrow">Nouveau commerce</p><h3>Ajouter un lieu à la carte</h3></div></div>
            <label>Nom du commerce
              <input type="text" value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} placeholder="Ex. Le Club des Sens" maxLength={120} />
            </label>
            <label>Type
              <select value={venueForm.type} onChange={(e) => setVenueForm({ ...venueForm, type: e.target.value })}>
                {(venueTypes.length ? venueTypes : ['Club libertin', 'Sex-shop', 'Glory hole', 'Sauna / lieu de rencontre', 'Bar / autre']).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Adresse complète (pour la géolocalisation)
              <input type="text" value={venueForm.address} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })} placeholder="12 rue Exemple, 75001 Paris" maxLength={240} />
            </label>
            <label>Description (facultatif)
              <textarea value={venueForm.description} onChange={(e) => setVenueForm({ ...venueForm, description: e.target.value })} placeholder="Ambiance, horaires, services…" maxLength={600} rows={3} />
            </label>
            <div className="admin-grid-v52 two">
              <label>Téléphone (facultatif)
                <input type="text" value={venueForm.phone} onChange={(e) => setVenueForm({ ...venueForm, phone: e.target.value })} placeholder="01 23 45 67 89" maxLength={40} />
              </label>
              <label>Site web (facultatif)
                <input type="text" value={venueForm.website} onChange={(e) => setVenueForm({ ...venueForm, website: e.target.value })} placeholder="https://…" maxLength={200} />
              </label>
            </div>
            <p className="hint">L’adresse est convertie automatiquement en position sur la carte. Si elle n’est pas reconnue, le lieu reste modifiable ci-contre.</p>
            <button type="submit" className="primary-btn full">Ajouter le commerce</button>
          </form>

          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Commerces enregistrés</p><h3>{venues.length} lieu{venues.length > 1 ? 'x' : ''}</h3></div></div>
            <div className="admin-venues-list-v96">
              {venues.map((venue) => (
                <div key={venue.id} className={cx('admin-venue-row-v96', !venue.located && 'unlocated')}>
                  <div className="admin-venue-main-v96">
                    <strong>{(VENUE_TYPE_ICONS[venue.type] || '📍')} {venue.name}</strong>
                    <small>{venue.type}{venue.city ? ` · ${venue.city}` : ''}</small>
                    <small className="venue-address-v96">{venue.address}</small>
                    {!venue.located ? <small className="admin-venue-warn-v96">⚠ Non localisé — corrigez l’adresse</small> : null}
                  </div>
                  <div className="admin-venue-actions-v96">
                    <button type="button" className="secondary-btn" onClick={() => relocateVenue(venue.id, venue.address)}>Adresse</button>
                    <button type="button" className="secondary-btn" style={{ color: 'var(--color-text-danger)' }} onClick={() => deleteVenue(venue.id, venue.name)}>Supprimer</button>
                  </div>
                </div>
              ))}
              {!venues.length ? <EmptyState title="Aucun commerce enregistré." subtitle="Ajoutez votre premier lieu avec le formulaire." /> : null}
            </div>
          </article>
        </div>
      ) : null}

      {activeSection === 'Système' ? (
        <div className="admin-grid-v52 two">
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Base de données</p><h3>État technique</h3></div></div>
            <div className="admin-db-card-v52"><strong>{database.type || 'db'}</strong><span>{database.path || 'Chemin non défini'}</span>{database.warning ? <p>{database.warning}</p> : <p>Stockage persistant actif. Les données survivent au redémarrage.</p>}</div>
            <div className="admin-metrics-list-v52">
              <span><b>{overview.legalVersion}</b> version légale</span>
              <span><b>{number(stats.activeSessions)}</b> sessions actives</span>
              <span><b>{number(stats.newUsers7d)}</b> nouveaux comptes 7 jours</span>
              <span><b>{number(stats.newUsers30d)}</b> nouveaux comptes 30 jours</span>
            </div>
          </article>
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Production</p><h3>Render</h3></div></div>
            <div className="admin-metrics-list-v52">
              <span><b>{adminInfo.configured ? 'OK' : 'À faire'}</b> identifiants admin Render</span>
              <span><b>{adminInfo.bootstrap ? 'Actif' : 'Non'}</b> admin bootstrap</span>
              <span><b>{security.ageVerificationProvider || 'none'}</b> prestataire âge</span>
              <span><b>{security.ageVerificationMode || 'declaration_only'}</b> mode inscription</span>
            </div>
            {(security.productionWarnings || adminInfo.warnings || []).map((warning) => <div className="admin-check-row-v52" key={warning}><span>!</span><div><strong>Avertissement</strong><p>{warning}</p><small>production</small></div></div>)}
          </article>
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Conservation médias</p><h3>Purge manuelle admin</h3><p>La purge automatique est désactivée. Les fichiers supprimés du site deviennent supprimables après 6 mois et uniquement par action admin.</p></div></div>
            <div className="admin-kpi-grid-v52 compact">
              <div className="admin-kpi-v52 gold"><strong>{number(mediaRetention.retainedDeletedMedia)}</strong><span>archivés</span></div>
              <div className="admin-kpi-v52 pink"><strong>{number(mediaRetention.eligibleForPurge)}</strong><span>éligibles purge</span></div>
              <div className="admin-kpi-v52 green"><strong>{number(mediaRetention.deletedMedia)}</strong><span>déjà purgés</span></div>
              <div className="admin-kpi-v52 blue"><strong>{mediaRetention.automaticPurge ? 'Auto' : 'Manuel'}</strong><span>mode</span></div>
            </div>
            <div className="admin-metrics-list-v52">
              <span><b>{mediaRetention.months || 6} mois</b> conservation technique maximum</span>
              <span><b>{mediaRetention.nextEligibleAt ? formatDate(mediaRetention.nextEligibleAt) : 'Aucun'}</b> prochaine éligibilité</span>
              <span><b>{number(mediaRetention.failedPurge)}</b> erreur(s) de purge</span>
            </div>
            <p className="hint">{mediaRetention.notice || MEDIA_RETENTION_TEXT}</p>
            <button type="button" className="secondary-btn danger-soft full" disabled={busyId === 'media-retention-purge'} onClick={purgeRetainedMedia}>Lancer la purge manuelle</button>
          </article>
          <article className="glass panel admin-panel-v52">
            <div className="panel-title-row small"><div><p className="eyebrow">Checklist</p><h3>Conformité</h3></div></div>
            {(overview.legalChecklist || []).map((item) => <div className="admin-check-row-v52" key={item.id}><span>{item.status === 'implemented' || item.status === 'implemented_demo' ? '✓' : '!'}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.status}</small></div></div>)}
          </article>
        </div>
      ) : null}
    </section>
  );
}

function SettingsPage({ me, onSaveNotificationPreferences, onContactSupport, showToast }) {
  const [preferences, setPreferences] = useState({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(me?.notificationPreferences || {}) });
  const [supportMessage, setSupportMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [browserStatus, setBrowserStatus] = useState(() => getBrowserNotificationStatus());
  const clientStatus = me?.clientStatus || {};
  const pwaInstaller = usePwaInstaller(showToast);
  useEffect(() => { setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(me?.notificationPreferences || {}) }); }, [me?.notificationPreferences]);

  async function toggle(key) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setBusy(key);
    try { await onSaveNotificationPreferences?.(next); }
    finally { setBusy(''); }
  }


  async function installApplication() {
    setBusy('install');
    try {
      const result = await pwaInstaller.installNow();
      await apiFetch('/profile/client-status', {
        method: 'POST',
        body: JSON.stringify({
          notificationsSupported: browserStatus.supported,
          notificationPermission: browserStatus.permission,
          notificationsEnabled: browserStatus.enabled,
          appInstalled: result?.status === 'accepted' || result?.status === 'installed' || isStandaloneApp() || localStorage.getItem(PWA_INSTALL_DONE_KEY) === 'true',
          standalone: isStandaloneApp(),
          platform: window.navigator.userAgentData?.platform || window.navigator.platform || '',
        }),
      }).catch(() => null);
    } finally { setBusy(''); }
  }

  async function askBrowserNotifications() {
    if (!browserStatus.supported) {
      showToast?.('Ce navigateur ne prend pas en charge les notifications.');
      return;
    }
    setBusy('browser');
    try {
      const permission = await window.Notification.requestPermission();
      setBrowserStatus(getBrowserNotificationStatus());
      if (permission === 'granted') {
        try { await ensurePushSubscription(); showToast?.('Notifications activées : vous serez alerté même application fermée.'); }
        catch { showToast?.('Notifications du navigateur activées (alertes hors application indisponibles sur cet appareil).'); }
      } else {
        showToast?.('Notifications non activées dans le navigateur.');
      }
      await apiFetch('/profile/client-status', {
        method: 'POST',
        body: JSON.stringify({
          notificationsSupported: true,
          notificationPermission: permission,
          notificationsEnabled: permission === 'granted',
          appInstalled: isStandaloneApp() || localStorage.getItem(PWA_INSTALL_DONE_KEY) === 'true',
          standalone: isStandaloneApp(),
          platform: window.navigator.userAgentData?.platform || window.navigator.platform || '',
        }),
      });
    } catch (err) {
      showToast?.(err.message || 'Activation impossible.');
    } finally { setBusy(''); }
  }

  async function sendSupport(event) {
    event.preventDefault();
    const message = supportMessage.trim();
    if (!message) return;
    setBusy('support');
    try {
      await onContactSupport?.(message);
      setSupportMessage('');
    } finally { setBusy(''); }
  }

  return (
    <section className="page settings-page-v68">
      <div className="section-heading">
        <p className="eyebrow">Paramètres</p>
        <h2 style={{ fontFamily: 'Georgia, serif' }}>Notifications & support</h2>
        <p>Gérez vos alertes et contactez notre équipe.</p>
      </div>
      <div className="settings-grid-v68">
        <article className="glass panel notification-settings-v68">
          <div className="panel-title-row small"><div><p className="eyebrow">Notifications</p><h3>Préférences de notifications</h3></div></div>
          <div className="notification-toggle-list-v68">
            {NOTIFICATION_PREFERENCE_ITEMS.map((item) => (
              <button type="button" key={item.key} className={cx('notification-toggle-v68', preferences[item.key] && 'active')} disabled={busy === item.key} onClick={() => toggle(item.key)}>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <em>{preferences[item.key] ? 'Activé' : 'Coupé'}</em>
              </button>
            ))}
          </div>
        </article>
        <article className="glass panel browser-settings-v68">
          <div className="panel-title-row small"><div><p className="eyebrow">Appareil</p><h3>État de votre appareil</h3></div></div>
          <div className="client-status-grid-v68">
            <span><b>{browserStatus.enabled ? '🔔 Oui' : '🔕 Non'}</b> notifications navigateur</span>
            <span><b>{pwaInstaller.installed || isStandaloneApp() || clientStatus.appInstalled ? '📲 Oui' : '🌐 Non'}</b> application installée</span>
            <span><b>{browserStatus.permission}</b> permission</span>
          </div>
          <button type="button" className="primary-btn full install-settings-btn-v70 ui-install-btn-v71 settings-install-action-v71" disabled={busy === 'install' || pwaInstaller.installed} onClick={installApplication}><InstallButtonContent installed={pwaInstaller.installed} /> <span className="settings-install-detail-v71">{pwaInstaller.installed ? 'Application déjà installée' : 'Installer l’application maintenant'}</span></button>
          <button type="button" className="secondary-btn full" disabled={busy === 'browser'} onClick={askBrowserNotifications}>Activer les notifications navigateur</button>
          <p className="hint">{pwaInstaller.hint}</p>
        </article>
        <form className="glass panel support-card-v68" onSubmit={sendSupport}>
          <div className="panel-title-row small"><div><p className="eyebrow">Aide</p><h3>Contacter support</h3></div></div>
          <textarea value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} placeholder="Décrivez votre problème ou votre question… Notre équipe répond sous 48h." rows={5} style={{ minHeight: 120 }} />
          <button type="submit" className="primary-btn full" disabled={busy === 'support' || !supportMessage.trim()}>
            {busy === 'support' ? 'Envoi en cours…' : 'Envoyer au support'}
          </button>
        </form>
      </div>
    </section>
  );
}


function privateAccessLabel(access = {}) {
  if (!access) return 'Aucun accès';
  if (access.status === 'requested') return access.exchangeRequested ? 'Échange demandé' : 'Demande en attente';
  if (access.status === 'granted') return access.expiresAt ? `Ouvert jusqu’au ${formatDate(access.expiresAt)}` : 'Ouvert sans limite';
  if (access.status === 'declined') return 'Refusé';
  if (access.status === 'revoked') return 'Retiré';
  if (access.status === 'expired') return 'Expiré';
  return 'Aucun accès';
}

function AlbumAccessManager({ showToast }) {
  const [data, setData] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const durations = [
    { label: '24h', seconds: 24 * 60 * 60 },
    { label: '7 jours', seconds: 7 * 24 * 60 * 60 },
    { label: '30 jours', seconds: 30 * 24 * 60 * 60 },
    { label: 'Infini', seconds: null },
  ];
  async function load() {
    setLoading(true);
    try {
      const result = await apiFetch('/album-access/requests');
      setData({ incoming: result.incoming || [], outgoing: result.outgoing || [] });
    } catch (err) {
      showToast?.(err.message || 'Impossible de charger les accès privés.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function respond(access, decision, durationSeconds = 24 * 60 * 60) {
    const key = `${access.ownerId}-${access.viewerId}-${decision}`;
    setBusy(key);
    try {
      const result = await apiFetch(`/album-access/${access.ownerId}/${access.viewerId}/respond`, { method: 'POST', body: JSON.stringify({ decision, albumId: access.albumId, durationSeconds }) });
      showToast?.(result.message || (decision === 'accept' ? 'Accès ouvert.' : 'Demande refusée.'));
      await load();
    } catch (err) {
      showToast?.(err.message || 'Action impossible.');
    } finally {
      setBusy('');
    }
  }
  async function revoke(access) {
    const key = `${access.ownerId}-${access.viewerId}-revoke`;
    setBusy(key);
    try {
      const result = await apiFetch(`/album-access/${access.ownerId}/${access.viewerId}?albumId=${encodeURIComponent(access.albumId || '')}`, { method: 'DELETE' });
      showToast?.(result.message || 'Accès retiré.');
      await load();
    } catch (err) {
      showToast?.(err.message || 'Retrait impossible.');
    } finally {
      setBusy('');
    }
  }
  const incomingRequests = data.incoming.filter((access) => access.status === 'requested');
  const grantedByMe = data.incoming.filter((access) => access.status === 'granted' && (!access.expiresAt || new Date(access.expiresAt).getTime() > Date.now()));
  const outgoing = data.outgoing.filter((access) => ['requested', 'granted', 'declined', 'revoked'].includes(access.status));
  return (
    <article className="glass panel private-access-panel-v138">
      <div className="panel-title-row small">
        <div><p className="eyebrow">Albums privés</p><h3>Demandes et accès accordés</h3></div>
        <button type="button" className="small-btn" onClick={load} disabled={loading}>↺ Actualiser</button>
      </div>
      <div className="private-access-grid-v138">
        <section>
          <h4>Demandes reçues</h4>
          <div className="private-access-list-v138">
            {incomingRequests.map((access) => (
              <div className="private-access-row-v138 request" key={access.id}>
                <Avatar profile={access.viewer} />
                <div>
                  <strong>{access.viewer?.pseudo || 'Membre'}</strong>
                  <small>{access.album?.title || 'Album privé'} • {access.exchangeRequested ? 'échange proposé' : 'demande simple'}</small>
                  <em>{privateAccessLabel(access)}</em>
                </div>
                <div className="private-access-actions-v138">
                  {durations.map((duration) => <button type="button" key={duration.label} className="small-btn" disabled={busy.startsWith(`${access.ownerId}-${access.viewerId}`)} onClick={() => respond(access, 'accept', duration.seconds)}>Accepter {duration.label}</button>)}
                  <button type="button" className="secondary-btn danger-soft" disabled={busy.startsWith(`${access.ownerId}-${access.viewerId}`)} onClick={() => respond(access, 'decline')}>Refuser</button>
                </div>
              </div>
            ))}
            {!incomingRequests.length ? <EmptyState title="Aucune demande en attente." subtitle="Les demandes d’accès ou d’échange apparaîtront ici." /> : null}
          </div>
        </section>
        <section>
          <h4>Accès que j’ai ouverts</h4>
          <div className="private-access-list-v138">
            {grantedByMe.map((access) => (
              <div className="private-access-row-v138 granted" key={access.id}>
                <Avatar profile={access.viewer} />
                <div>
                  <strong>{access.viewer?.pseudo || 'Membre'}</strong>
                  <small>{access.album?.title || 'Album privé'}</small>
                  <em>{privateAccessLabel(access)}</em>
                </div>
                <button type="button" className="secondary-btn danger-soft" disabled={busy === `${access.ownerId}-${access.viewerId}-revoke`} onClick={() => revoke(access)}>Retirer</button>
              </div>
            ))}
            {!grantedByMe.length ? <EmptyState title="Aucun accès ouvert actuellement." subtitle="Vous pouvez ouvrir votre album depuis le profil d’un membre." /> : null}
          </div>
        </section>
        <section className="private-access-outgoing-v138">
          <h4>Mes demandes envoyées</h4>
          <div className="private-access-list-v138 compact">
            {outgoing.map((access) => (
              <div className="private-access-row-v138 outgoing" key={access.id}>
                <Avatar profile={access.owner} />
                <div>
                  <strong>{access.owner?.pseudo || 'Membre'}</strong>
                  <small>{access.album?.title || 'Album privé'}</small>
                  <em>{privateAccessLabel(access)}</em>
                </div>
              </div>
            ))}
            {!outgoing.length ? <EmptyState title="Aucune demande envoyée." subtitle="Demandez l’accès depuis la fiche d’un profil." /> : null}
          </div>
        </section>
      </div>
    </article>
  );
}

function PrivacyPage({ me, blockedProfiles = [], onUnblock, onSaveSocialPreferences, showToast }) {
  const [legal, setLegal] = useState(null);
  const [blocks, setBlocks] = useState(blockedProfiles || []);
  const [busyId, setBusyId] = useState('');
  const [socialPrefs, setSocialPrefs] = useState(() => ({
    messagePermission: me?.socialPreferences?.messagePermission || 'everyone',
    mediaLikePermission: me?.socialPreferences?.mediaLikePermission || 'everyone',
    mediaCommentPermission: me?.socialPreferences?.mediaCommentPermission || 'everyone',
    showProfileViews: me?.socialPreferences?.showProfileViews !== false,
    allowWinks: me?.socialPreferences?.allowWinks !== false,
    allowAlbumRequests: me?.socialPreferences?.allowAlbumRequests !== false,
  }));
  useEffect(() => { apiFetch('/legal').then(setLegal).catch(() => setLegal(null)); }, []);
  useEffect(() => { setBlocks(blockedProfiles || []); }, [blockedProfiles]);
  useEffect(() => setSocialPrefs({
    messagePermission: me?.socialPreferences?.messagePermission || 'everyone',
    mediaLikePermission: me?.socialPreferences?.mediaLikePermission || 'everyone',
    mediaCommentPermission: me?.socialPreferences?.mediaCommentPermission || 'everyone',
    showProfileViews: me?.socialPreferences?.showProfileViews !== false,
    allowWinks: me?.socialPreferences?.allowWinks !== false,
    allowAlbumRequests: me?.socialPreferences?.allowAlbumRequests !== false,
  }), [me]);
  useEffect(() => {
    apiFetch('/blocks').then((result) => setBlocks(result.blocks || [])).catch(() => {});
  }, []);
  const docs = legal?.documents || {};
  const sections = Object.values(docs || {}).filter(Boolean);
  async function unblock(profileId) {
    setBusyId(profileId);
    try {
      await onUnblock?.(profileId);
      setBlocks((current) => current.filter((block) => block.profile?.id !== profileId && block.blockedId !== profileId));
    } catch (err) {
      showToast?.(err.message || 'Déblocage impossible.');
    } finally {
      setBusyId('');
    }
  }
  async function saveSocialPrivacy() {
    setBusyId('social-preferences');
    try {
      await onSaveSocialPreferences?.(socialPrefs);
    } finally {
      setBusyId('');
    }
  }
  const permissionOptions = [
    { value: 'everyone', label: 'Tout le monde' },
    { value: 'followers', label: 'Abonnés / profils qui me suivent' },
    { value: 'following', label: 'Profils que je suis' },
    { value: 'matches', label: 'Profils matchés' },
    { value: 'none', label: 'Personne' },
  ];
  return (
    <section className="page legal-page privacy-settings-page">
      <div className="section-heading">
        <p className="eyebrow">Confidentialité</p>
        <h2 style={{ fontFamily: 'Georgia, serif' }}>Confidentialité & blocages</h2>
        <p>Gérez vos blocages et consultez vos droits RGPD.</p>
      </div>

      <article className="glass panel user-compliance-panel-v78">
        <div><p className="eyebrow">Vos droits</p><h3>Consentement, vie privée & conservation</h3></div>
        <ul className="legal-list"><li>Le site est réservé aux personnes majeures.</li><li>La localisation reste approximative par ville.</li><li>{MEDIA_RETENTION_TEXT}</li><li>Les signalements et blocages sont accessibles depuis les profils, messages et le support.</li></ul>
      </article>

      <AlbumAccessManager showToast={showToast} />

      <article className="glass panel social-privacy-panel-v149">
        <div className="panel-title-row small"><div><p className="eyebrow">Interactions sociales</p><h3>Qui peut interagir avec moi ?</h3><p>Gardez le contrôle sur les messages, réactions, commentaires et albums privés.</p></div></div>
        <div className="form-grid two">
          <label className="field"><span>Qui peut m’envoyer un message</span><select value={socialPrefs.messagePermission} onChange={(e) => setSocialPrefs({ ...socialPrefs, messagePermission: e.target.value })}>{permissionOptions.filter((item) => ['everyone','following','matches','none'].includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field"><span>Qui peut liker mes médias</span><select value={socialPrefs.mediaLikePermission} onChange={(e) => setSocialPrefs({ ...socialPrefs, mediaLikePermission: e.target.value })}>{permissionOptions.filter((item) => ['everyone','followers','matches','none'].includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field"><span>Qui peut commenter mes médias</span><select value={socialPrefs.mediaCommentPermission} onChange={(e) => setSocialPrefs({ ...socialPrefs, mediaCommentPermission: e.target.value })}>{permissionOptions.filter((item) => ['everyone','followers','matches','none'].includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <div className="admin-toggle-row-v58 social-toggle-row-v149">
          <label><input type="checkbox" checked={socialPrefs.showProfileViews} onChange={(e) => setSocialPrefs({ ...socialPrefs, showProfileViews: e.target.checked })} /> Afficher mes vues de profil</label>
          <label><input type="checkbox" checked={socialPrefs.allowAlbumRequests} onChange={(e) => setSocialPrefs({ ...socialPrefs, allowAlbumRequests: e.target.checked })} /> Autoriser les demandes d’albums privés</label>
        </div>
        <button type="button" className="primary-btn" disabled={busyId === 'social-preferences'} onClick={saveSocialPrivacy}>{busyId === 'social-preferences' ? 'Sauvegarde…' : 'Sauvegarder mes préférences sociales'}</button>
      </article>

      <article className="glass panel blocked-users-panel">
        <div className="panel-title-row small"><div><p className="eyebrow">Liste de blocage</p><h3>Utilisateurs bloqués</h3></div></div>
        <div className="blocked-users-list">
          {blocks.map((block) => (
            <div className="blocked-user-row" key={block.id || block.blockedId}>
              <Avatar profile={block.profile} />
              <span><strong>{block.profile?.pseudo || 'Utilisateur'}</strong><small>{block.profile?.city || 'Ville discrète'} • bloqué le {formatDate(block.createdAt)}</small></span>
              <button type="button" className="small-btn" disabled={busyId === (block.profile?.id || block.blockedId)} onClick={() => unblock(block.profile?.id || block.blockedId)} style={{ color: '#9bffc8', borderColor: 'rgba(100,230,160,.35)', background: 'rgba(60,200,130,.06)' }}>{busyId === (block.profile?.id || block.blockedId) ? '…' : 'Débloquer'}</button>
            </div>
          ))}
          {!blocks.length ? <EmptyState title="Aucun utilisateur bloqué." /> : null}
        </div>
      </article>

      {sections.length ? (
        <div className="legal-stack">
          {sections.map((section) => (
            <article className="glass panel" key={section.title}>
              <p className="eyebrow">Version {section.version}</p>
              <h3>{section.title}</h3>
              <ul className="legal-list">{section.body.map((line) => <li key={line}>{line}</li>)}</ul>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}


function LoadingScreen() { return <div className="center-screen"><div className="orb" style={{ marginBottom: '1.4rem' }} /><h2 style={{ marginBottom: '0.4rem', fontFamily: 'Georgia, serif', background: 'linear-gradient(135deg,#fff 30%,#ff8fc5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Voluptia</h2><p style={{ color: 'rgba(255,236,230,.52)', fontSize: '.9rem' }}>Chargement en cours…</p></div>; }
function ErrorScreen({ error, onRetry }) { return <div className="center-screen"><div style={{ maxWidth: 420, textAlign: 'center', padding: '2rem' }}><div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: .6 }}>⚠</div><h2 style={{ marginBottom: '0.5rem' }}>Une erreur est survenue</h2><p style={{ color: 'rgba(255,236,230,.62)', marginBottom: '1.4rem', lineHeight: 1.6 }}>{error || 'Impossible de charger la plateforme. Vérifiez votre connexion.'}</p><button type="button" className="primary-btn" onClick={onRetry}>Réessayer</button></div></div>; }
function Stat({ value, label }) { return <div className="stat-card"><strong>{value}</strong><span>{label}</span></div>; }
function EmptyState({ title, subtitle, icon }) { return <div className="empty-state"><span style={{ fontSize: '2rem', marginBottom: 8, display: 'block', opacity: .5 }}>{icon || '✦'}</span><p style={{ fontWeight: 700, marginBottom: subtitle ? 4 : 0 }}>{title}</p>{subtitle ? <small style={{ color: 'rgba(255,236,230,.52)', lineHeight: 1.5 }}>{subtitle}</small> : null}</div>; }
function Avatar({ profile, large = false }) {
  const initials = (profile?.pseudo || 'AS').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className={cx('avatar', large && 'large')}>{profile?.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt={profile.pseudo || 'Profil'} /> : initials}</span>;
}

function CityField({ label, value, onChange, placeholder = 'Paris, Lyon…', compact = false }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const lastCheckedRef = useRef('');
  const requestIdRef = useRef(0);
  const blurTimerRef = useRef(null);

  useEffect(() => {
    const query = String(value || '').trim();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSuggesting(false);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSuggesting(true);
      try {
        const result = await apiFetch(`/geo/cities?q=${encodeURIComponent(query)}`);
        if (requestId !== requestIdRef.current) return;
        const next = Array.isArray(result.suggestions) ? result.suggestions : [];
        setSuggestions(next);
        setOpen(next.length > 0);
        setActiveIndex(next.length ? 0 : -1);
      } catch {
        if (requestId === requestIdRef.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (requestId === requestIdRef.current) setSuggesting(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [value]);

  function suggestionStatus(item) {
    const postal = item?.postalCodes?.length ? item.postalCodes.join(', ') : item?.postalCode;
    return `Ville sélectionnée : ${item?.city || ''}${postal ? ` · ${postal}` : ''}${item?.department ? ` · ${item.department}` : ''}`;
  }

  async function checkCity(overrideValue = '', preferredStatus = '') {
    const currentValue = overrideValue || value;
    const city = String(currentValue || '').trim();
    if (city.length < 2) {
      setStatus('');
      return;
    }
    const postalOnly = /^\d{4,5}$/.test(city.replace(/\s+/g, ''));
    if (!overrideValue && postalOnly && suggestions[0]) {
      await selectSuggestion(suggestions[0], { verify: true });
      return;
    }
    if (lastCheckedRef.current === normalize(city)) return;
    lastCheckedRef.current = normalize(city);
    setBusy(true);
    setStatus('Vérification de la ville…');
    try {
      const result = await apiFetch(`/geo/city?city=${encodeURIComponent(city)}`);
      const resolvedCity = result.city || result.location?.city || city;
      if (resolvedCity && normalize(resolvedCity) !== normalize(city)) onChange(resolvedCity);
      setStatus(preferredStatus || (result.location?.displayName ? `Ville trouvée : ${result.location.displayName}` : `Ville trouvée : ${resolvedCity}`));
    } catch {
      setStatus('Ville non trouvée automatiquement, elle sera gardée telle quelle.');
    } finally {
      setBusy(false);
    }
  }

  async function selectSuggestion(item, options = {}) {
    if (!item) return;
    const nextCity = item.city || item.label || '';
    onChange(nextCity);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setStatus(suggestionStatus(item));
    lastCheckedRef.current = '';
    if (options.verify) await checkCity(nextCity, suggestionStatus(item));
  }

  function handleKeyDown(event) {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(suggestions.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex], { verify: true });
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleBlur() {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = window.setTimeout(() => setOpen(false), 120);
    checkCity();
  }

  const hint = status || (suggesting ? 'Recherche des communes…' : 'Tape une ville ou un code postal, puis choisis la bonne commune.');

  return (
    <div className={cx('field city-field', compact && 'compact')}>
      <span>{label}</span>
      <div className="city-autocomplete-wrap">
        <input
          type="text"
          value={value ?? ''}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => { setStatus(''); onChange(e.target.value); }}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {open && suggestions.length ? (
          <div className="city-suggestions" role="listbox">
            {suggestions.map((item, index) => (
              <button
                type="button"
                key={item.id || `${item.city}-${index}`}
                className={cx(index === activeIndex && 'active')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item, { verify: true })}
                role="option"
                aria-selected={index === activeIndex}
              >
                <strong>{item.label || item.city}</strong>
                <small>{item.subtitle || item.displayName || 'Commune proposée'}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <small className={cx('city-field-status', (busy || suggesting) && 'loading')}>{hint}</small>
    </div>
  );
}

function ProfileMapPreview({ profile, compact = false }) {
  const src = cityMapEmbedUrl(profile);
  const mapUrl = cityMapUrl(profile);
  if (!src && !mapUrl) return null;
  return (
    <section className={cx('profile-map-preview', compact && 'compact')}>
      <div className="profile-map-header">
        <div>
          <strong>Plan approximatif</strong>
          <span>{profile?.city ? `${profile.city} • ${distanceLabel(profile)}` : 'Ville du profil'}</span>
        </div>
        {mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer">Ouvrir</a> : null}
      </div>
      {src ? <iframe title={`Plan approximatif ${profile?.city || ''}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : null}
      <p>Ville uniquement.</p>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', compact = false }) { return <label className={cx('field', compact && 'compact')}><span>{label}</span><input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function SelectField({ label, value, options = [], onChange, compact = false }) { return <label className={cx('field', compact && 'compact')}><span>{label}</span><select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{options.map((o) => { const optionValue = typeof o === 'object' ? o.value : o; const optionLabel = typeof o === 'object' ? o.label : o; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>; }
function TextareaField({ label, value, onChange, placeholder = '' }) { return <label className="field full-field"><span>{label}</span><textarea value={value ?? ''} placeholder={placeholder} rows={4} onChange={(e) => onChange(e.target.value)} /></label>; }
function PhotoInput({ label, value, onChange, showToast }) {
  function readFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast?.('Choisis un fichier image.'); return; }
    if (file.size > 1_200_000) { showToast?.('Image trop lourde : maximum 1,2 Mo en local.'); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  }
  return <div className="photo-input"><span>{label}</span><div className="photo-input-row"><div className="photo-preview">{value ? <img src={value} alt="Prévisualisation" /> : <em>Photo obligatoire</em>}</div><div className="photo-controls"><input type="file" accept="image/*" onChange={(e) => readFile(e.target.files?.[0])} /><input value={value?.startsWith('data:image/') ? '' : value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Ou coller une URL https://…" /></div></div></div>;
}
