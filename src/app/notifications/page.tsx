import { BellOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { markAllNotificationsRead, openNotification } from "./actions";

export default async function NotificationsPage() {
  const session = await requireSession();

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Updates on cases relevant to you.</p>
        </div>
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="text-sm font-medium text-brand hover:text-brand-hover">
              Mark all as read
            </button>
          </form>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <BellOff size={28} className="text-slate-300" />
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-center gap-3 px-5 py-4 text-left text-sm transition-colors hover:bg-slate-50 ${
                      !n.read ? "bg-brand-soft/40" : ""
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-brand" : "bg-transparent"}`}
                    />
                    <span className="flex-1">
                      <span className={n.read ? "text-slate-600" : "font-medium text-slate-900"}>
                        {n.message}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
