import db from "../../lib/db";
import { organization } from "../../lib/db/schema";

export default defineEventHandler(async () => {
  const orgs = await db.select({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
  }).from(organization);

  return orgs;
});
