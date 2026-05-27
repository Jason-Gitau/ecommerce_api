import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';

export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string; // Search by name or email

  @IsOptional()
  @IsEnum(Role)
  role?: Role; // Filter by role: USER or ADMIN

  @IsOptional()
  @IsString()
  status?: 'active' | 'banned'; // Filter by account status
}