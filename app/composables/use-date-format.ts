export function useFormatDate() {
  function formatDate(timestamp: number | null | undefined): string {
    if (!timestamp)
      return "TBD";
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateRange(start: number | null | undefined, end: number | null | undefined): string {
    if (!start)
      return "Dates TBD";
    if (!end || new Date(start).toDateString() === new Date(end).toDateString())
      return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  return { formatDate, formatDateRange };
}
