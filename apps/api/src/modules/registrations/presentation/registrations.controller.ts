import {
  DecideRegistrationRequestSchema,
  ExploreTournamentSchema,
  MyRegistrationSchema,
  RegisterRequestSchema,
  RegistrationCheckRequestSchema,
  RegistrationCheckSchema,
  RegistrationContextSchema,
  RegistrationCountsSchema,
  RegistrationSchema,
  SeedingRequestSchema,
  type ExploreTournament,
  type MyRegistration,
  type Registration,
  type RegistrationCheck,
  type RegistrationContext,
  type RegistrationCounts,
} from '@league/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  CheckRegistrationUseCase,
  DecideRegistrationUseCase,
  ExploreTournamentsUseCase,
  GetRegistrationContextUseCase,
  ListMyRegistrationsUseCase,
  ListRegistrationsUseCase,
  RegisterUseCase,
  RegistrationCountsUseCase,
  SeedRegistrationsUseCase,
  WithdrawRegistrationUseCase,
} from '../application/registrations.use-cases.js';

const uuid = new ParseUUIDPipe();
const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(90);
const CountsQuerySchema = z.object({
  ids: z
    .string()
    .default('')
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).max(200)),
});

/** Player portal: explore, check live, register, withdraw. */
@Controller()
@UseGuards(AccessTokenGuard)
export class RegistrationsController {
  constructor(
    @Inject(ExploreTournamentsUseCase) private readonly explore: ExploreTournamentsUseCase,
    @Inject(GetRegistrationContextUseCase)
    private readonly context: GetRegistrationContextUseCase,
    @Inject(CheckRegistrationUseCase) private readonly check: CheckRegistrationUseCase,
    @Inject(RegisterUseCase) private readonly register: RegisterUseCase,
    @Inject(ListMyRegistrationsUseCase) private readonly listMine: ListMyRegistrationsUseCase,
    @Inject(WithdrawRegistrationUseCase) private readonly withdraw: WithdrawRegistrationUseCase,
  ) {}

  @Get('tournaments/explore')
  async exploreTournaments(@CurrentUser() user: AuthenticatedUser): Promise<ExploreTournament[]> {
    return ExploreTournamentSchema.array().parse(await this.explore.execute(user.id));
  }

  @Get('tournaments/by-slug/:slug/registration')
  async registrationContext(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<RegistrationContext> {
    return RegistrationContextSchema.parse(
      await this.context.execute(user.id, validate(SlugSchema, slug)),
    );
  }

  @Post('tournaments/:id/registrations/check')
  @HttpCode(200)
  async checkRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<RegistrationCheck> {
    return RegistrationCheckSchema.parse(
      await this.check.execute(user.id, id, validate(RegistrationCheckRequestSchema, body)),
    );
  }

  @Post('tournaments/:id/registrations')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MyRegistration> {
    return MyRegistrationSchema.parse(
      await this.register.execute(user.id, id, validate(RegisterRequestSchema, body)),
    );
  }

  @Get('registrations/mine')
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<MyRegistration[]> {
    return MyRegistrationSchema.array().parse(await this.listMine.execute(user.id));
  }

  @Post('registrations/:id/withdraw')
  @HttpCode(200)
  async withdrawRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<MyRegistration> {
    return MyRegistrationSchema.parse(await this.withdraw.execute(user.id, id));
  }
}

/** Staff console: review, decide and seed (the use cases check the staff role). */
@Controller('admin')
@UseGuards(AccessTokenGuard)
export class AdminRegistrationsController {
  constructor(
    @Inject(ListRegistrationsUseCase) private readonly list: ListRegistrationsUseCase,
    @Inject(DecideRegistrationUseCase) private readonly decide: DecideRegistrationUseCase,
    @Inject(SeedRegistrationsUseCase) private readonly seed: SeedRegistrationsUseCase,
    @Inject(RegistrationCountsUseCase) private readonly counts: RegistrationCountsUseCase,
  ) {}

  @Get('registrations/counts')
  async registrationCounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ): Promise<RegistrationCounts> {
    return RegistrationCountsSchema.parse(
      await this.counts.execute(user.id, validate(CountsQuerySchema, query).ids),
    );
  }

  @Get('tournaments/:id/registrations')
  async registrations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<Registration[]> {
    return RegistrationSchema.array().parse(await this.list.execute(user.id, id));
  }

  @Post('registrations/:id/decision')
  @HttpCode(200)
  async decision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<Registration> {
    return RegistrationSchema.parse(
      await this.decide.execute(user.id, id, validate(DecideRegistrationRequestSchema, body)),
    );
  }

  @Post('tournaments/:id/seeding')
  @HttpCode(200)
  async seeding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<Registration[]> {
    return RegistrationSchema.array().parse(
      await this.seed.execute(user.id, id, validate(SeedingRequestSchema, body)),
    );
  }
}
