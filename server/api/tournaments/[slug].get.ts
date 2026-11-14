import { eq } from "drizzle-orm";

import db from "../../../lib/db";
import {
  divisionPolicy,
  tournament,
  tournamentDivision,
  tournamentRegistrationLock,
  tournamentVenue,
  venue,
} from "../../../lib/db/schema";
import { getTournamentStatus } from "../../utils/authorization";
import {
  getEnabledTournamentDisciplines,
  getTournamentRegistrationStatus,
  mapPolicyFromDb,
} from "../../utils/division-policy";

/**
 * Public API endpoint - returns tournament details by slug
 * Accessible to all users including guests
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: "Tournament slug is required",
    });
  }

  const tournaments = await db
    .select({
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      description: tournament.description,
      websiteUrl: tournament.websiteUrl,
      paymentInformation: tournament.paymentInformation,
      facilities: tournament.facilities,
      country: tournament.country,
      city: tournament.city,
      lat: tournament.lat,
      long: tournament.long,
      contactName: tournament.contactName,
      contactEmail: tournament.contactEmail,
      contactPhone: tournament.contactPhone,
      directorName: tournament.directorName,
      directorEmail: tournament.directorEmail,
      directorPhone: tournament.directorPhone,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      registrationOpenDate: tournament.registrationOpenDate,
      registrationCloseDate: tournament.registrationCloseDate,
      closedAt: tournament.closedAt,
      isSanctioned: tournament.isSanctioned,
      divisionOpen: tournament.divisionOpen,
      divisionWomen: tournament.divisionWomen,
      divisionMaster: tournament.divisionMaster,
      divisionGrandMaster: tournament.divisionGrandMaster,
      divisionSeniorGrandMaster: tournament.divisionSeniorGrandMaster,
      divisionLegend: tournament.divisionLegend,
      divisionJunior: tournament.divisionJunior,
      keepJuniorsSeparate: tournament.keepJuniorsSeparate,
      showDivisionInResults: tournament.showDivisionInResults,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
      organizationId: tournament.organizationId,
    })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const [t] = tournaments;

  if (!t) {
    throw createError({
      statusCode: 404,
      message: "Tournament not found",
    });
  }
  const tournamentStatus = getTournamentStatus(t.startDate, t.endDate);

  // Fetch associated venues for discipline locations
  const venues = await db
    .select({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      facilities: venue.facilities,
      lat: venue.lat,
      long: venue.long,
      hasGolf: tournamentVenue.hasGolf,
      hasAccuracy: tournamentVenue.hasAccuracy,
      hasDistance: tournamentVenue.hasDistance,
      hasSCF: tournamentVenue.hasSCF,
      hasDiscathon: tournamentVenue.hasDiscathon,
      hasDDC: tournamentVenue.hasDDC,
      hasFreestyle: tournamentVenue.hasFreestyle,
    })
    .from(tournamentVenue)
    .innerJoin(venue, eq(tournamentVenue.venueId, venue.id))
    .where(eq(tournamentVenue.tournamentId, t.id));

  const [policyRows, offeredRows, lockRows] = await Promise.all([
    db
      .select({ ageReferenceMode: divisionPolicy.ageReferenceMode })
      .from(divisionPolicy)
      .where(eq(divisionPolicy.tournamentId, t.id))
      .limit(1),
    db
      .select({
        code: tournamentDivision.code,
        label: tournamentDivision.label,
        isEnabled: tournamentDivision.isEnabled,
      })
      .from(tournamentDivision)
      .where(eq(tournamentDivision.tournamentId, t.id)),
    db
      .select({ isLocked: tournamentRegistrationLock.isLocked })
      .from(tournamentRegistrationLock)
      .where(eq(tournamentRegistrationLock.tournamentId, t.id))
      .limit(1),
  ]);

  const policyContext = mapPolicyFromDb(policyRows[0], offeredRows, t);
  const registrationState = getTournamentRegistrationStatus(t, !!lockRows[0]?.isLocked);
  const enabledDisciplines = getEnabledTournamentDisciplines(t);

  return {
    ...t,
    status: tournamentStatus,
    isActive: tournamentStatus === "active",
    venues,
    majorDivisions: policyContext.majorDivisions,
    offeredDivisionCodes: policyContext.offeredDivisionCodes,
    ageReferenceMode: policyContext.config.ageReferenceMode,
    enabledDisciplines,
    isRegistrationLocked: registrationState.isRegistrationLocked,
    isRegistrationOpen: registrationState.isRegistrationOpen,
    registrationStatusReason: registrationState.registrationStatusReason,
  };
});
