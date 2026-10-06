import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { RateInput } from "@/components/RateInput";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteMaterial, updateMaterial } from "../../actions";

export default async function EditMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("page.pricing");
  const { id } = await params;
  const { error } = await searchParams;

  const [material, usedBy] = await Promise.all([
    prisma.material.findUnique({ where: { id } }),
    prisma.case.count({ where: { materialId: id } }),
  ]);
  if (!material) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/settings/pricing"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to pricing
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Edit material</h1>
      <p className="mb-6 text-sm text-slate-500">
        New rates apply to cases created from now on. Existing cases keep the amounts they were
        created with (used by {usedBy} case{usedBy === 1 ? "" : "s"}).
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form
        action={updateMaterial}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id" value={material.id} />
        <div className="grid grid-cols-2 gap-4">
          <RateInput name="name" label="Name" type="text" required defaultValue={material.name} />
          <RateInput name="pricePerUnit" label="Price / unit" required defaultValue={material.pricePerUnit} />
          <RateInput
            name="ceramistFeePerUnit"
            label="Ceramist fee / unit"
            required
            defaultValue={material.ceramistFeePerUnit}
          />
          <RateInput
            name="designerFeePerUnit"
            label="Designer fee / unit"
            required
            defaultValue={material.designerFeePerUnit}
          />
          <RateInput
            name="ibarFeePerUnit"
            label="Ibar fee / unit (optional)"
            defaultValue={material.ibarFeePerUnit}
          />
          <RateInput name="extraFee" label="Extra fees / case (optional)" defaultValue={material.extraFee} />
          <RateInput name="deduction" label="Deduction / case (optional)" defaultValue={material.deduction} />
          <RateInput
            name="millingCostPerUnit"
            label="Milling cost / unit (optional)"
            defaultValue={material.millingCostPerUnit}
          />
          <RateInput
            name="photogrammetryCostPerUnit"
            label="Photogrammetry cost / unit (optional)"
            defaultValue={material.photogrammetryCostPerUnit}
          />
        </div>
        <button
          type="submit"
          className="mt-5 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Save changes
        </button>
      </form>

      {usedBy === 0 && (
        <form action={deleteMaterial} className="mt-6">
          <input type="hidden" name="id" value={material.id} />
          <ConfirmSubmitButton
            message={`Delete the material "${material.name}"?`}
            className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            <Trash2 size={15} />
            Delete this material
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
