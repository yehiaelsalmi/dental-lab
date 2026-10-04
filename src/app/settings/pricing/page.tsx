import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireRole } from "@/lib/session";
import { RateInput } from "@/components/RateInput";
import { formatEGP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createMaterial, createMetalType } from "./actions";

export default async function PricingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("LAB_LEADER");
  const { error } = await searchParams;

  const [materials, metalTypes] = await Promise.all([
    prisma.material.findMany({ orderBy: { name: "asc" } }),
    prisma.metalType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Pricing</h1>
      <p className="mb-6 text-sm text-slate-500">
        Fixed rates used to calculate each case&apos;s price and costs automatically.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Material</th>
              <th className="px-5 py-3 text-right font-medium">Price / unit</th>
              <th className="px-5 py-3 text-right font-medium">Ceramist fee / unit</th>
              <th className="px-5 py-3 text-right font-medium">Designer fee / unit</th>
              <th className="px-5 py-3 text-right font-medium">Ibar fee / unit</th>
              <th className="px-5 py-3 text-right font-medium">Extra fees / case</th>
              <th className="px-5 py-3 text-right font-medium">Deduction / case</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {materials.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{m.name}</td>
                <td className="px-5 py-3 text-right text-slate-700">{formatEGP(m.pricePerUnit)}</td>
                <td className="px-5 py-3 text-right text-slate-700">{formatEGP(m.ceramistFeePerUnit)}</td>
                <td className="px-5 py-3 text-right text-slate-700">{formatEGP(m.designerFeePerUnit)}</td>
                <td className="px-5 py-3 text-right text-slate-700">
                  {formatEGP(m.ibarFeePerUnit)}
                </td>
                <td className="px-5 py-3 text-right text-slate-700">
                  {formatEGP(m.extraFee)}
                </td>
                <td className="px-5 py-3 text-right text-slate-700">
                  {formatEGP(m.deduction)}
                </td>
                <td className="px-5 py-3 text-right">
                  <EditLink href={`/settings/pricing/materials/${m.id}`} />
                </td>
              </tr>
            ))}
            {materials.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  No materials yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={createMaterial} className="border-t border-slate-100 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RateInput name="name" label="Name" type="text" required />
            <RateInput name="pricePerUnit" label="Price / unit" required />
            <RateInput name="ceramistFeePerUnit" label="Ceramist fee / unit" required />
            <RateInput name="designerFeePerUnit" label="Designer fee / unit" required />
            <RateInput name="ibarFeePerUnit" label="Ibar fee / unit (optional)" />
            <RateInput name="extraFee" label="Extra fees / case (optional)" />
            <RateInput name="deduction" label="Deduction / case (optional)" />
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
              >
                Add material
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Case price = price per unit x units + extra fees - deduction.
          </p>
        </form>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Metal type</th>
              <th className="px-5 py-3 text-right font-medium">Cost / unit</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metalTypes.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{m.name}</td>
                <td className="px-5 py-3 text-right text-slate-700">{formatEGP(m.cost)}</td>
                <td className="px-5 py-3 text-right">
                  <EditLink href={`/settings/pricing/metals/${m.id}`} />
                </td>
              </tr>
            ))}
            {metalTypes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  No metal types yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={createMetalType} className="flex flex-wrap gap-3 border-t border-slate-100 p-4">
          <input
            name="name"
            required
            placeholder="Name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <input
            name="cost"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Cost / unit"
            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  );
}


function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand"
    >
      <Pencil size={13} />
      Edit
    </Link>
  );
}
