'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppNotification } from '@/lib/types';
import { Bell, Loader2, Inbox, CheckCheck } from 'lucide-react';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationsBellProps {
  unread: number;
  onMarkRead?: () => void;
}

export const NotificationsBell: React.FC<NotificationsBellProps> = ({ unread, onMarkRead }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const openPanel = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) {
        setError('Could not load notifications.');
        setNotifications([]);
        return;
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
      if ((data.unread || 0) > 0) {
        // Viewing the panel counts as reading — mark read and refresh the badge.
        await fetch('/api/notifications', { method: 'POST' }).catch(() => {});
        if (onMarkRead) onMarkRead();
      }
    } catch {
      setError('Could not load notifications.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [onMarkRead]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <button
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden
                        bg-white/95 border-slate-200 text-slate-800
                        dark:bg-slate-900/95 dark:border-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider">Notifications</h4>
            {notifications.length > 0 && (
              <button
                onClick={openPanel}
                title="Refresh"
                className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : error ? (
              <p className="px-4 py-8 text-xs text-amber-600 dark:text-amber-400">{error}</p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs font-semibold">No notifications yet</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Updates about your reports will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 ${n.read ? '' : 'bg-emerald-50/50 dark:bg-emerald-500/5'}`}
                  >
                    <p className="text-xs font-bold">{n.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};