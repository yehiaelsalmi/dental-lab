import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { RateInput } from "@/components/RateInput";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteMetalType, updateMetalType } from "../../actions";

export default async function EditMetalTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("LAB_LEADER");
  const { id } = await params;
  const { error } = await searchParams;

  const [metal, usedBy] = await Promise.all([
    prisma.metalType.findUnique({ where: { id } }),
    prisma.case.count({ where: { metalTypeId: id } }),
  ]);
  if (!metal) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/settings/pricing"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to pricing
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Edit metal type</h1>
      <p className="mb-6 text-sm text-slate-500">
        The new cost applies to cases created from now on. Existing cases keep the amounts they
        were created with (used by {usedBy} case{usedBy === 1 ? "" : "s"}).
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form
        action={updateMetalType}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id" value={metal.id} />
        <div className="grid grid-cols-2 gap-4">
          <RateInput name="name" label="Name" type="text" required defaultValue={metal.name} />
          <RateInput name="cost" label="Cost / unit" required defaultValue={metal.cost} />
        </div>
        <button
          type="submit"
          className="mt-5 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Save changes
        </button>
      </form>

      {usedBy === 0 && (
        <form action={deleteMetalType} className="mt-6">
          <input type="hidden" name="id" value={metal.id} />
          <ConfirmSubmitButton
            message={`Delete the metal type "${metal.name}"?`}
            className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            <Trash2 size={15} />
            Delete this metal type
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
