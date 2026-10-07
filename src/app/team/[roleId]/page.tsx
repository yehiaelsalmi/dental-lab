import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/access";
import { LAB_LEADER_KEY } from "@/lib/permissions";
import { earningsOnCase } from "@/lib/earnings";
import { formatEGP } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

const FINISHED = ["COMPLETED", "DELIVERED"];

// One page per role (Milling, Printing, Technician, ...): who has the role and
// which cases each person is on. Designers and ceramists have their own pages.
export default async function TeamRolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const access = await requirePermission("page.team");
  const { roleId } = await params;
  const showMoney = can(access, "money.viewAll");

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { users: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
  });
  if (!role || role.key === LAB_LEADER_KEY) notFound();

  const ids = role.users.map((u) => u.id);
  const cases = await prisma.case.findMany({
    where: {
      OR: [
        { assignedDesignerId: { in: ids } },
        { firstDesignerId: { in: ids } },
        { ceramistId: { in: ids } },
        { photogrammetryDoneById: { in: ids } },
        { assignments: { some: { userId: { in: ids } } } },
      ],
    },
    include: { doctor: true, assignments: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = role.users.map((user) => {
    const theirs = cases
      .map((c) => ({ c, items: earningsOnCase(c, user.id) }))
      .filter((r) => r.items.length > 0);
    return {
      user,
      cases: theirs,
      open: theirs.filter((r) => !FINISHED.includes(r.c.status)).length,
      fees: theirs.reduce((sum, r) => sum + r.items.reduce((s, i) => s + (i.amount ?? 0), 0), 0),
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">{role.name}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Everyone with the {role.name} role and the cases they&apos;re on.
        {role.assignable && " Assign them from the Team section on a case."}
        {showMoney && role.feePerUnit != null && ` Fee: ${formatEGP(role.feePerUnit)} per unit.`}
      </p>

      <div className="flex flex-col gap-6">
        {rows.map(({ user, cases: theirs, open, fees }) => (
          <section key={user.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.name}
                  {!user.active && <span className="ml-2 text-xs font-normal text-slate-400">(disabled)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="flex shrink-0 gap-6 text-right">
                <Stat value={String(open)} label="Open" accent />
                <Stat value={String(theirs.length)} label="Total" />
                {showMoney && <Stat value={formatEGP(fees)} label="Fees" />}
              </div>
            </div>
            {theirs.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-400">No cases yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {theirs.map(({ c, items }) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5">
                          <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:text-brand">
                            {c.patientName}
                          </Link>
                          <p className="text-xs text-slate-500">{c.doctor.name}</p>
                        </td>
                        <td className="px-5 py-2.5 text-slate-500">{items.map((i) => i.label).join(", ")}</td>
                        {showMoney && (
                          <td className="px-5 py-2.5 text-right text-slate-700">
                            {formatEGP(items.reduce((s, i) => s + (i.amount ?? 0), 0))}
                          </td>
                        )}
                        <td className="px-5 py-2.5 text-right">
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
            Nobody has the {role.name} role yet. Add people on the Users page.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-semibold ${accent ? "text-brand" : "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
