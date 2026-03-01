export function useTournamentPermissions(slug: MaybeRefOrGetter<string>) {
  const slugValue = computed(() => toValue(slug));

  const { data: editPermission, pending: editPending } = useFetch<{ canEdit: boolean; isSysadmin?: boolean }>(
    () => `/api/tournaments/${slugValue.value}/check-edit-permission`,
    {
      default: () => ({ canEdit: false, isSysadmin: false }),
      watch: [slugValue],
    },
  );

  const { data: invitePermission, pending: invitePending } = useFetch<{ canInvite: boolean }>(
    () => `/api/tournaments/${slugValue.value}/check-invite-permission`,
    {
      default: () => ({ canInvite: false }),
      watch: [slugValue],
    },
  );

  const canEditTournament = computed(() => editPermission.value?.canEdit === true);
  const isSysadmin = computed(() => editPermission.value?.isSysadmin === true);
  const canInviteMembers = computed(() => invitePermission.value?.canInvite === true);
  const permissionsPending = computed(() => editPending.value || invitePending.value);

  return {
    canEditTournament,
    isSysadmin,
    canInviteMembers,
    permissionsPending,
  };
}
