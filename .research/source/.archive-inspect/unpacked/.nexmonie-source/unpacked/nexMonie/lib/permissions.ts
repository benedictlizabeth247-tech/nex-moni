/**
 * @fileOverview Permission and RBAC helper primitives.
 * Prepared for future integration with user roles and claims.
 */

import { UserRole } from '@/constants';

export type AppPermission = 
  | 'view:balance'
  | 'create:transfer'
  | 'approve:withdrawal'
  | 'manage:banks'
  | 'manage:users'
  | 'view:analytics'
  | 'p2p:trade';

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  [UserRole.GUEST]: [],
  [UserRole.USER]: ['view:balance', 'create:transfer', 'p2p:trade'],
  [UserRole.VERIFIED_USER]: ['view:balance', 'create:transfer', 'p2p:trade'],
  [UserRole.FOUNDER]: ['view:balance', 'create:transfer', 'approve:withdrawal', 'manage:banks', 'manage:users', 'view:analytics', 'p2p:trade'],
  [UserRole.ADMIN]: ['view:balance', 'manage:users', 'view:analytics'],
  [UserRole.MODERATOR]: ['view:analytics'],
};

export function hasPermission(role: UserRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
