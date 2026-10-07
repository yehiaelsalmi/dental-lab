"use server";

import { randomBytes } from "node:crypto";
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

// Users with no history are removed completely. Anyone who appears on cases,
// files, reviews or invoices is closed instead: they can't sign in, they're
// hidden from the Users page and their email is freed, but their name stays on
// past work so reports and earnings remain correct.
export async function deleteUserAction(formData: FormData) {
  const access = await requirePermission("page.users");
  const userId = formData.get("userId") as string;
  if (userId === access.userId) fail("You can't delete your own account.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) fail("That user no longer exists.");
  await assertLeaderRemains(userId);

  const [cases, files, reviews, invoices] = await Promise.all([
    prisma.case.count({
      where: {
        OR: [
          { createdById: userId },
          { assignedDesignerId: userId },
          { firstDesignerId: userId },
          { ceramistId: userId },
          { photogrammetryDoneById: userId },
          { assignments: { some: { userId } } },
        ],
      },
    }),
    prisma.caseFile.count({ where: { uploadedById: userId } }),
    prisma.caseReview.count({ where: { reviewedById: userId } }),
    prisma.invoice.count({ where: { generatedById: userId } }),
  ]);

  if (cases + files + reviews + invoices === 0) {
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        active: false,
        deletedAt: new Date(),
        email: `deleted-${user.id}@deleted.invalid`,
        passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      },
    });
  }

  revalidatePath("/users");
  redirect(`/users?deleted=${encodeURIComponent(user.name)}`);
}

// Fixed monthly salary; empty clears it.
export async function setSalaryAction(formData: FormData) {
  await requirePermission("page.users");
  const userId = formData.get("userId") as string;
  const raw = String(formData.get("baseSalary") ?? "").trim();
  const amount = raw === "" ? null : Number(raw);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) fail("Enter a valid salary.");

  await prisma.user.update({ where: { id: userId }, data: { baseSalary: amount || null } });
  revalidatePath("/users");
}

// Sets a new password chosen (or generated) by the person managing users.
// Only a Lab Leader can reset another Lab Leader's password, so access to the
// Users page can't be used to take over a leader's account.
export async function resetPasswordAction(formData: FormData) {
  const access = await requirePermission("page.users");
  const userId = formData.get("userId") as string;
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) fail("The new password must be at least 8 characters.");

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || user.deletedAt) fail("That user no longer exists.");
  if (user.role.key === LAB_LEADER_KEY && access.role.key !== LAB_LEADER_KEY) {
    fail("Only a Lab Leader can reset a Lab Leader's password.");
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/users");
  redirect(`/users?reset=${encodeURIComponent(user.name)}`);
}
