-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_channels" (
    "id" TEXT NOT NULL,
    "slack_integration_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_notifications" (
    "id" TEXT NOT NULL,
    "slack_channel_id" TEXT NOT NULL,
    "changelog_entry_id" TEXT NOT NULL,
    "message_ts" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_user_id_team_id_key" ON "slack_integrations"("user_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_channels_slack_integration_id_channel_id_key" ON "slack_channels"("slack_integration_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_notifications_slack_channel_id_changelog_entry_id_key" ON "slack_notifications"("slack_channel_id", "changelog_entry_id");

-- AddForeignKey
ALTER TABLE "slack_integrations" ADD CONSTRAINT "slack_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_channels" ADD CONSTRAINT "slack_channels_slack_integration_id_fkey" FOREIGN KEY ("slack_integration_id") REFERENCES "slack_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_notifications" ADD CONSTRAINT "slack_notifications_slack_channel_id_fkey" FOREIGN KEY ("slack_channel_id") REFERENCES "slack_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_notifications" ADD CONSTRAINT "slack_notifications_changelog_entry_id_fkey" FOREIGN KEY ("changelog_entry_id") REFERENCES "changelog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
