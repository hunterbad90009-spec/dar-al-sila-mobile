export type MarketplaceRole = "buyer" | "merchant" | "admin";
export type MerchantStatus = "none" | "pending" | "active" | "rejected" | "suspended";

export interface SubscriptionCapabilities {
  status: "pending" | "active" | "expired" | "suspended" | "cancelled";
  canUseStore: boolean;
  canManageProducts: boolean;
  canReplyToChats: boolean;
  maxProducts: number;
  maxImagesPerProduct: number;
}

export interface MarketplacePrincipal {
  role: "user" | "admin" | "merchant";
  merchantStatus?: MerchantStatus | null;
  subscription?: SubscriptionCapabilities | null;
}

export interface MarketplacePermissions {
  canBrowseStores: boolean;
  canViewStoreProfile: boolean;
  canCreateStandardListing: boolean;
  canUseSubscribedStore: boolean;
  canContactStore: boolean;
  canCallStore: boolean;
  canManageOwnStore: boolean;
  canManageOwnProducts: boolean;
  canReplyToStoreChats: boolean;
  canModerateStores: boolean;
}

export function resolveMarketplaceRole(principal: MarketplacePrincipal): MarketplaceRole {
  if (principal.role === "admin") return "admin";
  if (
    principal.role === "merchant" &&
    principal.merchantStatus === "active" &&
    principal.subscription?.status === "active" &&
    principal.subscription.canUseStore
  ) return "merchant";
  return "buyer";
}

export function getMarketplacePermissions(principal: MarketplacePrincipal): MarketplacePermissions {
  const role = resolveMarketplaceRole(principal);
  return {
    canBrowseStores: true,
    canViewStoreProfile: true,
    canCreateStandardListing: true,
    canUseSubscribedStore: role === "merchant" || role === "admin",
    canContactStore: role === "buyer" || role === "merchant",
    canCallStore: role === "buyer" || role === "merchant",
    canManageOwnStore: role === "merchant" || role === "admin",
    canManageOwnProducts: role === "merchant" || role === "admin",
    canReplyToStoreChats: role === "merchant" || role === "admin",

    canModerateStores: role === "admin",
  };
}

export function assertPermission(
  principal: MarketplacePrincipal,
  permission: keyof MarketplacePermissions,
): void {
  if (!getMarketplacePermissions(principal)[permission]) {
    throw new Error("FORBIDDEN_MARKETPLACE_PERMISSION");
  }
}

export function assertMerchantActive(principal: MarketplacePrincipal): void {
  if (resolveMarketplaceRole(principal) !== "merchant") {
    throw new Error("MERCHANT_SUBSCRIPTION_NOT_ACTIVE");
  }
}
