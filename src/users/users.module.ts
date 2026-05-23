import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Inject PrismaService
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 🔑 Critical: Allows AuthModule to use UsersService
})
export class UsersModule {}