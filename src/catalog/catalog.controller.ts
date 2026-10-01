import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CatalogService } from './catalog.service';

/**
 * Public storefront endpoints. No authentication: customers browse the
 * catalogue without an account.
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('medicines')
  async listMedicines(@Query() query: CatalogQueryDto) {
    return {
      success: true,
      message: 'Medicines loaded.',
      data: await this.catalogService.listMedicines(query),
    };
  }

  @Get('medicines/:id')
  async getMedicine(@Param('id', new ParseUUIDPipe()) id: string) {
    return {
      success: true,
      message: 'Medicine loaded.',
      data: await this.catalogService.getMedicine(id),
    };
  }

  @Get('pharmacy')
  pharmacy() {
    return {
      success: true,
      message: 'Pharmacy details loaded.',
      data: this.catalogService.getPharmacy(),
    };
  }
}
