import type { RegistrationStatusReason } from "~/types/tournament-registration";

export function getRegistrationStatusBadge(reason: RegistrationStatusReason | string | null | undefined) {
  switch (reason) {
    case "open":
      return { label: "Registration Open", badgeClass: "badge-success" };
    case "not_yet_open":
      return { label: "Not Yet Open", badgeClass: "badge-warning" };
    case "registration_closed_date":
      return { label: "Registration Closed", badgeClass: "badge-neutral" };
    case "locked_by_staff":
      return { label: "Registration Locked", badgeClass: "badge-warning" };
    case "tournament_started":
      return { label: "Tournament In Progress", badgeClass: "badge-info" };
    case "tournament_closed":
      return { label: "Tournament Finalized", badgeClass: "badge-ghost" };
    default:
      return { label: "Closed", badgeClass: "badge-neutral" };
  }
}

export function formatRegistrationWindow(
  start: number | null | undefined,
  end: number | null | undefined,
  formatDate: (timestamp: number) => string,
) {
  if (!start && !end) {
    return "Open until tournament start";
  }
  if (start && end) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  if (start) {
    return `Opens ${formatDate(start)}`;
  }
  return `Closes ${formatDate(end!)}`;
}
