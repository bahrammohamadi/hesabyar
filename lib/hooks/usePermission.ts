"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "./useOrg";
import { roleHasPermission, getRolePermissions, normalizePermission } from "@/lib/permissions";

export function usePermission() {
  const { role, loading } = useOrg();

  const { data: userPermissions } = useQuery({
    queryKey: ["current-user-permissions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const permissions = data.user?.app_metadata?.permissions;
      return Array.isArray(permissions) ? permissions.map(String) : null;
    },
    staleTime: 60_000,
  });

  return useMemo(() => ({
    role,
    loading,
    permissions: userPermissions ?? getRolePermissions(role as any),
    can: (permission?: string | null) => {
      const normalized = normalizePermission(permission);
      if (!normalized) return true;
      if (userPermissions && userPermissions.length > 0) {
        return userPermissions.includes("*") || userPermissions.includes(normalized);
      }
      return roleHasPermission(role as any, normalized);
    },
  }), [role, loading, userPermissions]);
}
