"use client"

import * as React from "react"
import { toast } from "sonner"

import { adminListUsers, ApiError } from "@/lib/api"
import type { AdminUser, UserRole } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ROLE_FILTERS: { value: UserRole | "ALL"; label: string }[] = [
  { value: "ALL", label: "All roles" },
  { value: "ADVERTISER", label: "Advertiser" },
  { value: "PUBLISHER", label: "Publisher" },
  { value: "ADMIN", label: "Admin" },
]

export function UsersPanel() {
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "ALL">("ALL")
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async (role: UserRole | "ALL") => {
    setLoading(true)
    try {
      const result = await adminListUsers({
        pageSize: 100,
        role: role === "ALL" ? undefined : role,
      })
      setUsers(result.users)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load users"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(roleFilter)
  }, [load, roleFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="user-role-filter">Role</Label>
          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as UserRole | "ALL")}
          >
            <SelectTrigger id="user-role-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !loading && users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No users match this filter.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(user.balance_usd)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="grid gap-3 sm:hidden">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <Badge variant="outline">{user.role}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="tabular-nums">
                      {formatCurrency(user.balance_usd)}
                    </span>
                    <span className="text-muted-foreground">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
