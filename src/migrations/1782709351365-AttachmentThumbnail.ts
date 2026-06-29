import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttachmentThumbnail1782709351365 implements MigrationInterface {
  name = 'AttachmentThumbnail1782709351365';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message_attachments" ADD "thumbnail_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message_attachments" DROP COLUMN "thumbnail_url"`,
    );
  }
}
