"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { getStatuses } from "@/lib/statuses";
import {
  CASE_SCOPES,
  LAB_LEADER_KEY,
  PERMISSION_KEYS,
  PHOTOGRAMMETRY_NEEDED,
} from "@/lib/permissions";

const roleSchema = z.object({
  name: z.string().trim().min(1, "Give the role a name").max(40, "Keep the name under 40 characters"),
  permissions: z.array(z.enum(PERMISSION_KEYS as [string, ...string[]])),
  caseScope: z.enum(CASE_SCOPES.map((s) => s.key) as [string, ...string[]]),
  visibleStatuses: z.array(z.string()).min(1, "Tick at least one status the role can see"),
  notifyOn: z.array(z.string()),
});

// Built-in and custom statuses; unknown keys from the form are dropped.
async function parseRole(formData: FormData) {
  const statusKeys = (await getStatuses()).map((s) => s.key);
  const result = roleSchema.safeParse({
    name: formData.get("name"),
    permissions: formData.getAll("permissions"),
    caseScope: formData.get("caseScope"),
    visibleStatuses: formData.getAll("visibleStatuses"),
    notifyOn: formData.getAll("notifyOn"),
  });
  if (!result.success) return result;
  const known = (k: string) => statusKeys.includes(k);
  const visibleStatuses = result.data.visibleStatuses.filter(known);
  return {
    ...result,
    data: {
      ...result.data,
      // Ticking every status is the same as "all statuses" (and keeps new
      // custom statuses visible).
      visibleStatuses: visibleStatuses.length === statusKeys.length ? [] : visibleStatuses,
      notifyOn: result.data.notifyOn.filter((e) => known(e) || e === PHOTOGRAMMETRY_NEEDED),
    },
  };
}

function toData(data: z.infer<typeof roleSchema>) {
  return {
    name: data.name,
    permissions: JSON.stringify(data.permissions),
    caseScope: data.caseScope,
    visibleStatuses: JSON.stringify(data.visibleStatuses),
    notifyOn: JSON.stringify(data.notifyOn),
  };
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "A role with that name already exists.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createRole(formData: FormData) {
  await requirePermission("page.roles");
  const parsed = await parseRole(formData);
  if (!parsed.success) {
    redirect(`/settings/roles/new?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await prisma.role.create({ data: toData(parsed.data) });
  } catch (error) {
    redirect(`/settings/roles/new?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/settings/roles");
  redirect("/settings/roles?saved=1");
}

export async function updateRole(formData: FormData) {
  await requirePermission("page.roles");
  const id = formData.get("id") as string;
  const back = `/settings/roles/${id}`;

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) redirect("/settings/roles");
  if (role.key === LAB_LEADER_KEY) {
    redirect(`${back}?error=${encodeURIComponent("The Lab Leader role always has full access.")}`);
  }

  const parsed = await parseRole(formData);
  if (!parsed.success) redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  try {
    await prisma.role.update({ where: { id }, data: toData(parsed.data) });
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/settings/roles");
  redirect("/settings/roles?saved=1");
}

export async function deleteRole(formData: FormData) {
  await requirePermission("page.roles");
  const id = formData.get("id") as string;
  const back = `/settings/roles/${id}`;

  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: { where: { deletedAt: null } } } } },
  });
  if (!role) redirect("/settings/roles");
  if (role.key === LAB_LEADER_KEY) {
    redirect(`${back}?error=${encodeURIComponent("The Lab Leader role can't be deleted.")}`);
  }
  if (role._count.users > 0) {
    redirect(
      `${back}?error=${encodeURIComponent(
        `${role._count.users} user${role._count.users === 1 ? " has" : "s have"} this role. Move them to another role first.`
      )}`
    );
  }

  // Deleted users still point at their old role; park them on the Lab Leader
  // role (which can't be deleted). They can't sign in, so it grants nothing.
  const leaderRole = await prisma.role.findUniqueOrThrow({ where: { key: LAB_LEADER_KEY } });
  await prisma.user.updateMany({ where: { roleId: id }, data: { roleId: leaderRole.id } });
  await prisma.role.delete({ where: { id } });
  revalidatePath("/settings/roles");
  redirect("/settings/roles");
}
