import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Logger,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() createProductDto: CreateProductDto) {
    this.logger.log(`POST /products — name: "${createProductDto.name}"`);
    try {
      const result = await this.productsService.create(createProductDto);
      this.logger.log(`Product created — name: "${createProductDto.name}"`);
      return result;
    } catch (err) {
      this.logger.error(`Create product failed — name: "${createProductDto.name}": ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Get()
  async findAll(@Query() query: QueryProductsDto) {
    this.logger.log(`GET /products — query: ${JSON.stringify(query)}`);
    try {
      const result = await this.productsService.findAll(query);
      this.logger.log('Fetched products list');
      return result;
    } catch (err) {
      this.logger.error(`Fetch products failed: ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    this.logger.log(`GET /products/${id}`);
    try {
      const result = await this.productsService.findOne(id);
      this.logger.log(`Fetched product ${id}`);
      return result;
    } catch (err) {
      this.logger.error(`Fetch product ${id} failed: ${err.message}`);
      throw err;
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    this.logger.log(`PATCH /products/${id}`);
    try {
      const result = await this.productsService.update(id, updateProductDto);
      this.logger.log(`Product ${id} updated`);
      return result;
    } catch (err) {
      this.logger.error(`Update product ${id} failed: ${err.message}`);
      throw err;
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    this.logger.log(`DELETE /products/${id}`);
    try {
      const result = await this.productsService.remove(id);
      this.logger.log(`Product ${id} deleted`);
      return result;
    } catch (err) {
      this.logger.error(`Delete product ${id} failed: ${err.message}`);
      throw err;
    }
  }
}