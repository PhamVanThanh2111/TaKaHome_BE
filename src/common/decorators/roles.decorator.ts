import { SetMetadata } from '@nestjs/common';

/**
 * Dùng @Roles('ADMIN') hoặc @Roles('TENANT', 'LANDLORD')
 * để đánh dấu các route cần quyền truy cập.
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
