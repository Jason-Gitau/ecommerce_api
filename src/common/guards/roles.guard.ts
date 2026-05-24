import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. If no roles required, allow access (route is not role-protected)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. Get the authenticated user (attached by JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();
    
    // 4. Check if user has one of the required roles
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}