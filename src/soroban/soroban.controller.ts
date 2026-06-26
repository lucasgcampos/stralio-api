import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SorobanService } from './soroban.service';
import { RegisterContractDto } from './dto/register-contract.dto';
import { AddWebhookDto } from './dto/add-webhook.dto';

@ApiTags('soroban')
@Controller('soroban')
export class SorobanController {
  constructor(private readonly sorobanService: SorobanService) {}

  @Post('contracts')
  @ApiOperation({ summary: 'Register a new Soroban contract' })
  @ApiResponse({ status: 201, description: 'Contract registered' })
  registerContract(@Body() dto: RegisterContractDto) {
    return this.sorobanService.registerContract(dto);
  }

  @Get('contracts')
  @ApiOperation({ summary: 'List all registered contracts' })
  @ApiResponse({ status: 200, description: 'Array of contracts' })
  listContracts() {
    return this.sorobanService.listContracts();
  }

  @Delete('contracts/:id')
  @ApiOperation({ summary: 'Remove a contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract removed' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  removeContract(@Param('id') id: string) {
    return this.sorobanService.removeContract(id);
  }

  @Post('contracts/:id/webhooks')
  @ApiOperation({ summary: 'Add webhook for contract events' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  addWebhook(@Param('id') id: string, @Body() dto: AddWebhookDto) {
    return this.sorobanService.addWebhook(id, dto.url);
  }

  @Get('events')
  @ApiOperation({ summary: 'List recent blockchain events' })
  @ApiResponse({ status: 200, description: 'Array of events' })
  listEvents() {
    return this.sorobanService.listEvents();
  }

  @Get('state')
  @ApiOperation({ summary: 'Get event ingestion state' })
  @ApiResponse({ status: 200, description: 'Ingest state' })
  getIngestState() {
    return this.sorobanService.getIngestState();
  }
}
