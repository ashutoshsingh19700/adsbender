"use client"

import * as React from "react"
import { toast } from "sonner"
import { Ban, Trash2 } from "lucide-react"

import {
  adminAddBlacklistedIp,
  adminListBlacklistedIps,
  adminRemoveBlacklistedIp,
  ApiError,
} from "@/lib/api"
import type { BlacklistedIp } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Manual moderation for the same blacklist FraudDetectionService checks on
// every /serve and /click request (see fraud-detection.service.ts) and the
// honeypot trap auto-populates. An admin can add an IP off other evidence
// (dashboard patterns, an external abuse report) or remove one that was
// blocked in error.
export function BlacklistPanel() {
  const [ips, setIps] = React.useState<BlacklistedIp[]>([])
  const [loading, setLoading] = React.useState(true)
  const [removing, setRemoving] = React.useState<Record<string, boolean>>({})
  const [newIp, setNewIp] = React.useState("")
  const [newReason, setNewReason] = React.useState("")
  const [adding, setAdding] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await adminListBlacklistedIps({ pageSize: 100 })
      setIps(result.ips)
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not load blacklisted IPs"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const handleAdd = async () => {
    if (!newIp.trim() || !newReason.trim()) {
      toast.error("An IP address and reason are both required")
      return
    }

    setAdding(true)
    try {
      await adminAddBlacklistedIp({
        ipAddress: newIp.trim(),
        reason: newReason.trim(),
      })
      toast.success(`${newIp.trim()} added to the blacklist`)
      setNewIp("")
      setNewReason("")
      await load()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not add IP"
      )
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (entry: BlacklistedIp) => {
    setRemoving((prev) => ({ ...prev, [entry.id]: true }))
    try {
      await adminRemoveBlacklistedIp(entry.id)
      toast.success(`${entry.ipAddress} removed from the blacklist`)
      setIps((prev) => prev.filter((ip) => ip.id !== entry.id))
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not remove IP"
      )
    } finally {
      setRemoving((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground/75">
        Every request from a blacklisted IP is rejected before an ad is
        served or a click is tracked - see{" "}
        <code className="text-xs">FraudDetectionService</code>.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="blacklist-ip">IP address</Label>
            <Input
              id="blacklist-ip"
              placeholder="203.0.113.42"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
            />
          </div>
          <div className="grid min-w-56 flex-1 gap-1.5">
            <Label htmlFor="blacklist-reason">Reason</Label>
            <Input
              id="blacklist-reason"
              placeholder="Reported click fraud from this IP"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={adding}>
            <Ban className="size-4" />
            {adding ? "Adding..." : "Blacklist IP"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : ips.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP address</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ips.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">
                        {entry.ipAddress}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.source === "HONEYPOT" ? "destructive" : "secondary"
                          }
                        >
                          {entry.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate font-medium text-foreground/75">
                        {entry.reason}
                      </TableCell>
                      <TableCell className="font-medium text-foreground/75">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(entry)}
                          disabled={removing[entry.id]}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm font-medium text-foreground/75">
              No IPs are currently blacklisted.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
