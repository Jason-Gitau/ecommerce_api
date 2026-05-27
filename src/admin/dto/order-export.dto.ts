import { IsOptional, IsDateString, IsString } from 'class-validator';

export class OrderExportDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // e.g., 2026-01-01

  @IsOptional()
  @IsDateString()
  endDate?: string;   // e.g., 2026-12-31

  @IsOptional()
  @IsString()
  status?: string;    // e.g., PENDING, SHIPPED, CANCELLED
}