import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '@/app.module';
import { RedisIoAdapter } from '@realtime/realtime.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
  logger.log('   WebSocket namespace: /notifications (JWKS-authenticated)');
}

void bootstrap();
