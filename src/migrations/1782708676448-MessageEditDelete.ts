import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageEditDelete1782708676448 implements MigrationInterface {
  name = 'MessageEditDelete1782708676448';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "edited_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "edited_at"`,
    );
  }
}
