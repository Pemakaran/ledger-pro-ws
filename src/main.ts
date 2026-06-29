import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from '@/app.module';
import { RedisIoAdapter } from '@realtime/realtime.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Zod is the validation stack (class-validator was dropped); this validates
  // every createZodDto body/query at the HTTP edge.
  app.useGlobalPipes(new ZodValidationPipe());

  // Drain in-flight work and close Redis connections cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // socket.io MUST use the Redis adapter: it lets multiple realtime replicas
  // share rooms/broadcasts, and is how the backend's PUBLISH reaches a client
  // no matter which instance holds its connection.
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(config.getOrThrow<string>('REDIS_URL'));
  app.useWebSocketAdapter(redisAdapter);

  const port = Number(config.get<string>('PORT', '3001'));
  await app.listen(port);

  logger.log(`🚀 LedgerPro Realtime listening on http://localhost:${port}`);
  logger.log(
    '   WebSocket namespaces: /notifications, /chat (JWKS-authenticated)',
  );
}

void bootstrap();
