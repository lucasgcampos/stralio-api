import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { SorobanService } from './soroban.service';
import { RegisterContractDto } from './dto/register-contract.dto';
import { AddWebhookDto } from './dto/add-webhook.dto';

@Controller('soroban')
export class SorobanController {
  constructor(private readonly sorobanService: SorobanService) {}

  @Post('contracts')
  registerContract(@Body() dto: RegisterContractDto) {
    return this.sorobanService.registerContract(dto);
  }

  @Get('contracts')
  listContracts() {
    return this.sorobanService.listContracts();
  }

  @Delete('contracts/:id')
  removeContract(@Param('id') id: string) {
    return this.sorobanService.removeContract(id);
  }

  @Post('contracts/:id/webhooks')
  addWebhook(@Param('id') id: string, @Body() dto: AddWebhookDto) {
    return this.sorobanService.addWebhook(id, dto.url);
  }

  @Get('events')
  listEvents() {
    return this.sorobanService.listEvents();
  }

  @Get('state')
  getIngestState() {
    return this.sorobanService.getIngestState();
  }
}
