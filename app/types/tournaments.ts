export type TournamentDisciplineFlags = {
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
};

export type PublicTournament = TournamentDisciplineFlags & {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  country: string | null;
  city: string | null;
  lat: number;
  long: number;
  contactName: string | null;
  contactEmail: string | null;
  startDate: number | null;
  endDate: number | null;
  status: "active" | "future" | "past";
  isActive: boolean;
};

export type VenueCourseLayoutItem = {
  id?: string;
  name: string;
  par: number;
  holeCount: number | null;
  sortOrder?: number;
};

export type TournamentEditVenue = TournamentDisciplineFlags & {
  id: number;
  name: string;
  description: string | null;
  facilities: string | null;
  lat: number;
  long: number;
  baseHasGolf?: boolean;
  baseHasAccuracy?: boolean;
  baseHasDistance?: boolean;
  baseHasSCF?: boolean;
  baseHasDiscathon?: boolean;
  baseHasDDC?: boolean;
  baseHasFreestyle?: boolean;
  courseLayouts?: VenueCourseLayoutItem[];
};

export type TournamentEditResponse = TournamentDisciplineFlags & {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  paymentInformation: string | null;
  facilities: string | null;
  country: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  directorName: string | null;
  directorEmail: string | null;
  directorPhone: string | null;
  lat: number;
  long: number;
  startDate: number | null;
  endDate: number | null;
  registrationOpenDate: number | null;
  registrationCloseDate: number | null;
  closedAt: number | null;
  isSanctioned: boolean;
  divisionOpen: boolean;
  divisionWomen: boolean;
  divisionMaster: boolean;
  divisionGrandMaster: boolean;
  divisionSeniorGrandMaster: boolean;
  divisionLegend: boolean;
  divisionJunior: boolean;
  keepJuniorsSeparate: boolean;
  showDivisionInResults: boolean;
  banRequestEmailEnabled: boolean;
  organizationId: string | null;
  venues: TournamentEditVenue[];
  availableVenues: TournamentEditVenue[];
  availableVenueRadiusKm: number;
};

export type GolfRoundLayoutSnapshotItem = {
  venueId?: number | null;
  venueName?: string | null;
  layoutId?: string | null;
  layoutName?: string | null;
};

export type GolfVenueWithLayouts = {
  id: number;
  name: string;
  courseLayouts: Array<{
    id: string;
    name: string;
    par: number;
    holeCount: number | null;
  }>;
};

export type DisciplineSettingsResponse = {
  discipline: string;
  label: string;
  isEnabled: boolean;
  rounds: number | null;
  cumulativeRounds: number | null;
  poolMode?: "static" | "dynamic";
  poolCount?: number;
  golfStartEnabled?: boolean;
  roundPars?: Array<number | null>;
  roundLayouts?: Array<GolfRoundLayoutSnapshotItem | null>;
  golfVenues?: GolfVenueWithLayouts[];
};

export type InviteTournamentOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type CheckEditPermissionResponse = {
  canEdit: boolean;
  isSysadmin: boolean;
};
