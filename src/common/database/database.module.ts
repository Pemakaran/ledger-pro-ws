import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

const isTrue = (value: unknown): boolean => value === true || value === 'true';

/**
 * Owns the chat Postgres connection. The realtime service is otherwise stateless;
 * chat is its only persisted domain, in its own database (DB_NAME, default
 * "chat"). Entities are auto-loaded from the feature modules. Dev sets
 * DB_SYNC=true to auto-create the schema; prod runs migrations with DB_SYNC off.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'chat'),
        autoLoadEntities: true,
        synchronize: isTrue(config.get('DB_SYNC')),
        logging: isTrue(config.get('DB_LOGGING')),
        ssl: isTrue(config.get('DB_SSL'))
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
  ],
})
export class DatabaseModule {}
