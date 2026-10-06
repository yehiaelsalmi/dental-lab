"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { LAB_LEADER_KEY } from "@/lib/permissions";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().min(1, "Pick a role"),
});

function fail(message: string): never {
  redirect(`/users?error=${encodeURIComponent(message)}`);
}

// The lab must always keep at least one active Lab Leader, or nobody could
// manage users and roles any more.
async function assertLeaderRemains(changingUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: changingUserId }, include: { role: true } });
  if (!user || user.role.key !== LAB_LEADER_KEY || !user.active) return;
  const leaders = await prisma.user.count({
    where: { active: true, role: { key: LAB_LEADER_KEY } },
  });
  if (leaders <= 1) fail("This is the last active Lab Leader. Make someone else a Lab Leader first.");
}

export async function createUser(formData: FormData) {
  await requirePermission("page.users");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) fail(parsed.error.issues.map((i) => i.message).join(", "));

  const { name, email, password, roleId } = parsed.data;
  if (!(await prisma.role.findUnique({ where: { id: roleId } }))) fail("That role no longer exists.");
  if (await prisma.user.findUnique({ where: { email } })) fail("A user with that email already exists.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash, roleId } });

  revalidatePath("/users");
}

export async function changeUserRoleAction(formData: FormData) {
  await requirePermission("page.users");
  const userId = formData.get("userId") as string;
  const roleId = formData.get("roleId") as string;

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) fail("That role no longer exists.");
  if (role.key !== LAB_LEADER_KEY) await assertLeaderRemains(userId);

  await prisma.user.update({ where: { id: userId }, data: { roleId } });
  revalidatePath("/users");
}

export async function toggleUserActiveAction(formData: FormData) {
  await requirePermission("page.users");

  const userId = formData.get("userId") as string;
  const nextActive = formData.get("nextActive") === "true";
  if (!nextActive) await assertLeaderRemains(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { active: nextActive },
  });

  revalidatePath("/users");
}
