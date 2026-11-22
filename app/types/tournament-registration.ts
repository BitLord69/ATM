import type { DivisionAgePolicy } from "#shared/utils/division-age";

export type RegistrationStatusReason
  = | "open"
    | "not_yet_open"
    | "registration_closed_date"
    | "locked_by_staff"
    | "tournament_started"
    | "tournament_closed";

export type MajorDivisionOption = { code: string; label: string };
export type DisciplineOption = { key: string; label: string };

/** Subset of the public tournament payload needed by the registration panel. */
export type TournamentRegistrationInfo = {
  startDate: number | null;
  registrationOpenDate: number | null;
  registrationCloseDate: number | null;
  majorDivisions: MajorDivisionOption[];
  enabledDisciplines: DisciplineOption[];
  divisionAgePolicy: DivisionAgePolicy;
  isRegistrationOpen: boolean;
  registrationStatusReason: RegistrationStatusReason;
};

export type MyRegistrationResponse = {
  authenticated: boolean;
  profile: {
    playerId: string | null;
    displayName: string;
    country: string;
    email: string;
    pdgaNumber: string;
    homeClub: string;
    dateOfBirth: string;
    genderCategory: "open" | "women";
  } | null;
  playerNumber: number | null;
  entries: Array<{
    id: string;
    discipline: string;
    majorDivision: string;
    minorDivisionTags: string[];
    primaryMinorDivision: string | null;
    activeCompetitiveDivision: string;
    status: string;
    createdAt: number;
    updatedAt: number;
  }>;
  derivedMinorDivisions: string[];
  primaryMinorDivision: string | null;
};

export type TournamentPlayerGroup = {
  playerId: string;
  userId: string | null;
  isGuest: boolean;
  displayName: string;
  country: string | null;
  email: string | null;
  pdgaNumber: string | null;
  homeClub: string | null;
  dateOfBirth: string | null;
  genderCategory: string | null;
  playerNumber: number | null;
  majorDivision: string;
  minorDivisionTags: string[];
  primaryMinorDivision: string | null;
  activeDisciplines: string[];
  withdrawnDisciplines: string[];
  overallStatus: "registered" | "withdrawn";
};

export type TournamentEntriesResponse = {
  tournamentId: number;
  canManage: boolean;
  majorDivisions: MajorDivisionOption[];
  enabledDisciplines: DisciplineOption[];
  players: TournamentPlayerGroup[];
};

export type UserSearchResult = {
  id: string;
  name: string;
  email: string;
  country: string | null;
};
