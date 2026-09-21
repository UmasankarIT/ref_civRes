import { AuthUser, AppNotification } from './types';
import { civicStore } from './store';

export function logAction(
  actor: AuthUser,
  action: string,
  detail: string,
  issueId?: string
): void {
  civicStore.addAuditLog({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    actorId: actor.userId,
    actorName: actor.name,
    role: actor.role,
    action,
    issueId,
    detail,
    createdAt: new Date().toISOString(),
  });
}

export function notifyUser(
  userId: string,
  title: string,
  body: string,
  issueId?: string
): void {
  const n: AppNotification = {
    id: `not-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    userId,
    issueId,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  };
  civicStore.pushNotification(n);
}