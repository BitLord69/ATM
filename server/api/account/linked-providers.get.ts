import { eq } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { account } from "../../../lib/db/schema";

const PROVIDERS = [
  {
    providerId: "github",
    label: "GitHub",
    icon: "tabler:brand-github",
  },
  {
    providerId: "google",
    label: "Google",
    icon: "tabler:brand-google",
  },
  {
    providerId: "facebook",
    label: "Facebook",
    icon: "tabler:brand-facebook",
  },
  {
    providerId: "credential",
    label: "Email / Password",
    icon: "tabler:mail",
  },
] as const;

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const linkedAccounts = await db
    .select({
      providerId: account.providerId,
      accountId: account.accountId,
      password: account.password,
    })
    .from(account)
    .where(eq(account.userId, session.user.id));

  const socialProviderIds = new Set(["github", "google", "facebook"]);
  const socialProviderCount = linkedAccounts.filter(item => socialProviderIds.has(item.providerId)).length;
  const hasPasswordLogin = linkedAccounts.some(
    item => item.providerId === "credential" && typeof item.password === "string" && item.password.length > 0,
  );

  const linkedByProvider = new Map(linkedAccounts.map(item => [item.providerId, item]));

  return PROVIDERS.map((provider) => {
    const linked = linkedByProvider.get(provider.providerId);
    const isSocial = socialProviderIds.has(provider.providerId);
    const canUnlinkSocialProvider = isSocial
      && Boolean(linked)
      && (hasPasswordLogin || socialProviderCount > 1);

    return {
      providerId: provider.providerId,
      label: provider.label,
      icon: provider.icon,
      linked: Boolean(linked),
      canUnlink: canUnlinkSocialProvider,
      accountId: linked?.accountId ?? null,
    };
  });
});
