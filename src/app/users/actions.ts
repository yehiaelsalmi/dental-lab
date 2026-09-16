"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

export async function createUser(formData: FormData) {
  await requireRole("LAB_LEADER");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { name, email, password, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  revalidatePath("/users");
}

export async function toggleUserActiveAction(formData: FormData) {
  await requireRole("LAB_LEADER");

  const userId = formData.get("userId") as string;
  const nextActive = formData.get("nextActive") === "true";

  await prisma.user.update({
    where: { id: userId },
    data: { active: nextActive },
  });

  revalidatePath("/users");
}
