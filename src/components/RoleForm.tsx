import { CASE_STATUSES, CASE_STATUS_LABELS } from "@/lib/constants";
import {
  CASE_SCOPES,
  PERMISSIONS,
  PHOTOGRAMMETRY_NEEDED,
  type CaseScope,
} from "@/lib/permissions";

export type RoleFormValues = {
  name: string;
  permissions: string[];
  caseScope: CaseScope;
  visibleStatuses: string[]; // empty = every status
  notifyOn: string[];
};

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

// The create/edit form for a role. `locked` shows the Lab Leader role
// read-only (it always has everything).
export function RoleForm({
  action,
  values,
  roleId,
  locked,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  values: RoleFormValues;
  roleId?: string;
  locked?: boolean;
  submitLabel: string;
}) {
  const allStatuses = values.visibleStatuses.length === 0;

  return (
    <form action={action} className="flex flex-col gap-6">
      {roleId && <input type="hidden" name="id" value={roleId} />}
      <fieldset disabled={locked} className="flex flex-col gap-6 disabled:opacity-70">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Role name
            <input
              name="name"
              required
              defaultValue={values.name}
              placeholder="e.g. Milling"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">What they can do</h2>
          <p className="mb-4 text-xs text-slate-500">Everyone can open the Cases list and their own account.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                <div className="flex flex-col gap-2">
                  {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                    <label key={p.key} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="permissions"
                        value={p.key}
                        defaultChecked={values.permissions.includes(p.key)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Which cases they see</h2>
          <div className="mb-4 mt-3 flex flex-col gap-2">
            {CASE_SCOPES.map((scope) => (
              <label key={scope.key} className="flex items-start gap-2.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="caseScope"
                  value={scope.key}
                  defaultChecked={values.caseScope === scope.key}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                />
                {scope.label}
              </label>
            ))}
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Only in these statuses (leave all ticked to see every status):
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CASE_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="visibleStatuses"
                  value={status}
                  defaultChecked={allStatuses || values.visibleStatuses.includes(status)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                {CASE_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Notify them (app + email) when</h2>
          <p className="mb-3 text-xs text-slate-500">
            Only for cases they can see. Designers and ceramists are always told when a case is
            assigned to them.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="notifyOn"
                value={PHOTOGRAMMETRY_NEEDED}
                defaultChecked={values.notifyOn.includes(PHOTOGRAMMETRY_NEEDED)}
                className="h-4 w-4 shrink-0 accent-brand"
              />
              A case needs photogrammetry
            </label>
            {CASE_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="notifyOn"
                  value={status}
                  defaultChecked={values.notifyOn.includes(status)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                A case reaches {CASE_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </section>
      </fieldset>

      {!locked && (
        <button
          type="submit"
          className="self-start rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          {submitLabel}
        </button>
      )}
    </form>
  );
}
