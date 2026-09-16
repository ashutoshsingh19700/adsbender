"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BellIcon } from "@hugeicons/core-free-icons"

import {
  ApiError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api"
import type { Notification } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { HIcon } from "@/components/app/h-icon"

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Shared by AdvertiserTopbar and PublisherTopbar - was previously a
// decorative, non-functional button (see git history) with a permanent fake
// "unread" dot and no click handler at all.
export function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const load = React.useCallback(async () => {
    try {
      const result = await listNotifications({ pageSize: 20 })
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    } catch (error) {
      // Non-fatal - the bell just shows nothing new rather than blocking
      // the rest of the topbar on this call.
      if (!(error instanceof ApiError)) {
        console.error(error)
      }
    } finally {
      setLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Cheap polling for the unread badge - no websocket/SSE infra exists
    // yet for this app, and a topbar badge doesn't need to be real-time.
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  React.useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  async function handleOpen() {
    const next = !open
    setOpen(next)
    if (next) await load()
  }

  async function handleNotificationClick(notification: Notification) {
    setOpen(false)
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      )
      setUnreadCount((count) => Math.max(0, count - 1))
      markNotificationRead(notification.id).catch(() => {
        // Best-effort - a failed mark-as-read isn't worth surfacing to the
        // user over, the next load() will reconcile the real state anyway.
      })
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch (error) {
      if (!(error instanceof ApiError)) {
        console.error(error)
      }
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-full font-medium text-foreground/75 hover:text-foreground"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={handleOpen}
      >
        <HIcon icon={BellIcon} className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500" />
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-violet-600 hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="px-3 py-6 text-center text-sm font-medium text-foreground/75">
                Loading...
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-medium text-foreground/75">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    {!notification.read ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />
                    ) : (
                      <span className="size-1.5 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{notification.title}</span>
                  </span>
                  <span className="pl-3.5 text-sm font-medium text-foreground/75">
                    {notification.message}
                  </span>
                  <span className="pl-3.5 text-xs font-medium text-foreground/75">
                    {timeAgo(notification.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
