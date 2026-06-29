import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialChatSchema1782707374413 implements MigrationInterface {
  name = 'InitialChatSchema1782707374413';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "chat_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "title" character varying, "reference_id" uuid, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ff117d9f57807c4f2e3034a39f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_chat_conversations_group_reference" ON "chat_conversations" ("reference_id") WHERE type = 'group'`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_message_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "url" character varying NOT NULL, "public_id" character varying NOT NULL, "mime_type" character varying NOT NULL, "file_name" character varying NOT NULL, "size" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_32257163343877aa40d676a71cc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ba00841386439fa3dd8a77df9" ON "chat_message_attachments" ("message_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bdfd8165e694fe9d3ce4140c87" ON "chat_messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying NOT NULL DEFAULT 'member', "last_read_at" TIMESTAMP WITH TIME ZONE, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ebf68c52a2b4dceb777672b782d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dd056fd5d6c8628fa309d1c0a3" ON "chat_participants" ("conversation_id", "user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "FK_7ba00841386439fa3dd8a77df98" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_3d623662d4ee1219b23cf61e649" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_participants" ADD CONSTRAINT "FK_fb3a8029a2688a74971e918df79" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_participants" DROP CONSTRAINT "FK_fb3a8029a2688a74971e918df79"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_3d623662d4ee1219b23cf61e649"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message_attachments" DROP CONSTRAINT "FK_7ba00841386439fa3dd8a77df98"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dd056fd5d6c8628fa309d1c0a3"`,
    );
    await queryRunner.query(`DROP TABLE "chat_participants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bdfd8165e694fe9d3ce4140c87"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ba00841386439fa3dd8a77df9"`,
    );
    await queryRunner.query(`DROP TABLE "chat_message_attachments"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_chat_conversations_group_reference"`,
    );
    await queryRunner.query(`DROP TABLE "chat_conversations"`);
  }
}
