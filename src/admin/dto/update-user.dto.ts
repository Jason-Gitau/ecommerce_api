import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role; // Allow admin to promote/demote users

  @IsOptional()
  @IsBoolean()
  isBanned?: boolean; // Soft ban: user can't login but data is preserved

  @IsOptional()
  @IsString()
  adminNotes?: string; // Internal notes for support team
}