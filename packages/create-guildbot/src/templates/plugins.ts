/**
 * Plugin templates — generates all official plugin modules.
 *
 * Each plugin lives in src/plugins/<name>/ with every command in its own file
 * under src/plugins/<name>/commands/ (or events/ for event handlers).
 *
 * ── How to add a new command ──────────────────────────────────────────────
 *  1. Create src/plugins/<your-plugin>/commands/<name>.ts
 *  2. Export a named Command constant.
 *  3. Import and add it to the commands array in the plugin's index.ts.
 *  4. Run `npm run deploy-commands` to push the slash command to Discord.
 *
 * ── How to add a new plugin ───────────────────────────────────────────────
 *  1. Create src/plugins/<name>/index.ts exporting a Plugin as default.
 *  2. Add the plugin name to ENABLED_PLUGINS in your .env file.
 *  3. PluginLoader auto-discovers it on next start.
 */

import type { BotConfig, PluginChoice } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getPluginTemplates(config: BotConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const pluginMap: Record<PluginChoice, () => GeneratedFile[]> = {
    utility:          utilityPlugin,
    moderation:       moderationPlugin,
    leveling:         levelingPlugin,
    economy:          economyPlugin,
    logging:          loggingPlugin,
    welcome:          welcomePlugin,
    "reaction-roles": reactionRolesPlugin,
  };

  for (const pluginId of config.plugins) {
    const gen = pluginMap[pluginId];
    if (gen) files.push(...gen());
  }

  return files;
}

// =============================================================================
// UTILITY PLUGIN
// =============================================================================
function utilityPlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/utility/index.ts",
      content: `/**
 * Utility plugin — general-purpose commands every bot needs.
 *
 * Commands: /ping, /help, /serverinfo, /userinfo, /avatar, /invite
 */

import type { Plugin } from "../../core/types";
import { pingCommand }       from "./commands/ping";
import { helpCommand }       from "./commands/help";
import { serverInfoCommand } from "./commands/serverinfo";
import { userInfoCommand }   from "./commands/userinfo";
import { avatarCommand }     from "./commands/avatar";
import { inviteCommand }     from "./commands/invite";

const plugin: Plugin = {
  name: "utility",
  version: "1.0.0",
  description: "General-purpose utility commands.",
  commands: [pingCommand, helpCommand, serverInfoCommand, userInfoCommand, avatarCommand, inviteCommand],
  events: [],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/utility/commands/ping.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const pingCommand: Command = {
  name: "ping",
  description: "Check the bot latency and Discord API response time.",
  slashCommand: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot latency and Discord API response time."),

  async execute(ctx) {
    const sent = await ctx.interaction?.deferReply({ fetchReply: true });
    const roundtrip = sent ? Date.now() - sent.createdTimestamp : 0;
    const wsLatency = ctx.client.ws.ping;
    const color = wsLatency < 100 ? 0x2ecc71 : wsLatency < 250 ? 0xf1c40f : 0xe74c3c;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Roundtrip", value: \`\${roundtrip} ms\`, inline: true },
        { name: "WebSocket", value: \`\${wsLatency} ms\`,  inline: true },
      )
      .setTimestamp();

    if (ctx.interaction?.deferred) {
      await ctx.interaction.editReply({ embeds: [embed] });
    } else {
      await ctx.reply({ embeds: [embed] } as never);
    }
  },
};
`,
    },
    {
      filePath: "src/plugins/utility/commands/help.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const helpCommand: Command = {
  name: "help",
  description: "List all available commands or get details for a specific one.",
  aliases: ["commands", "?"],
  slashCommand: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all available commands.")
    .addStringOption((o) =>
      o
        .setName("command")
        .setDescription("Get details for a specific command.")
        .setRequired(false),
    ),

  async execute(ctx) {
    // RexxyClient exposes the full command collection for exactly this purpose.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmdMap = (ctx.client as any).__rexxyCommands as
      | Map<string, { name: string; description: string }>
      | undefined;

    const specific = ctx.interaction?.options.getString("command")?.toLowerCase();

    if (specific && cmdMap) {
      const cmd = cmdMap.get(specific);
      if (!cmd) return ctx.reply(\`❌ Unknown command \\\`\${specific}\\\`.\`);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(\`/\${cmd.name}\`)
        .setDescription(cmd.description)
        .setFooter({ text: "Powered by Rexxy" });

      return ctx.reply({ embeds: [embed] } as never);
    }

    const commands = cmdMap ? [...cmdMap.values()] : [];
    const lines    = commands.map((c) => \`\\\`/\${c.name}\\\` — \${c.description}\`);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📖 Available Commands")
      .setDescription(lines.length ? lines.join("\\n") : "No commands loaded.")
      .setFooter({ text: \`\${commands.length} command(s) · Powered by Rexxy\` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/utility/commands/serverinfo.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import type { Command } from "../../../core/types";

export const serverInfoCommand: Command = {
  name: "serverinfo",
  description: "Display information about this server.",
  aliases: ["server", "si"],
  slashCommand: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display information about this server."),

  async execute(ctx) {
    const guild = ctx.interaction?.guild;
    if (!guild) return ctx.reply("❌ This command must be used in a server.");

    await guild.members.fetch();

    const owner      = await guild.fetchOwner().catch(() => null);
    const botCount   = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = guild.memberCount - botCount;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "Owner",       value: owner ? \`<@\${owner.id}>\` : "Unknown",                                   inline: true },
        { name: "Region",      value: guild.preferredLocale,                                                    inline: true },
        { name: "Created",     value: time(guild.createdAt, TimestampStyles.RelativeTime),                      inline: true },
        { name: "Members",     value: \`👤 \${humanCount} humans\\n🤖 \${botCount} bots\`,                    inline: true },
        { name: "Channels",    value: \`\${guild.channels.cache.size}\`,                                       inline: true },
        { name: "Roles",       value: \`\${guild.roles.cache.size - 1}\`,                                      inline: true },
        { name: "Emojis",      value: \`\${guild.emojis.cache.size}\`,                                         inline: true },
        { name: "Boost tier",  value: \`Level \${guild.premiumTier}\`,                                         inline: true },
      )
      .setFooter({ text: \`ID: \${guild.id}\` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/utility/commands/userinfo.ts",
      content: `import { EmbedBuilder, GuildMember, SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import type { Command } from "../../../core/types";

export const userInfoCommand: Command = {
  name: "userinfo",
  description: "Display information about a member.",
  aliases: ["user", "whois", "ui"],
  slashCommand: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Display information about a member.")
    .addUserOption((o) =>
      o.setName("user").setDescription("The user to look up.").setRequired(false),
    ),

  async execute(ctx) {
    const target =
      (ctx.interaction?.options.getMember("user") as GuildMember | null) ??
      (ctx.interaction?.member as GuildMember | null);

    if (!target) return ctx.reply("❌ Could not find that user.");

    const user  = target.user;
    const roles = target.roles.cache
      .filter((r) => r.id !== ctx.interaction?.guild?.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => \`<@&\${r.id}>\`)
      .slice(0, 10)
      .join(" ") || "None";

    const embed = new EmbedBuilder()
      .setColor(target.displayColor || 0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Mention",         value: \`<@\${user.id}>\`,                                                  inline: true },
        { name: "ID",              value: user.id,                                                              inline: true },
        { name: "Bot",             value: user.bot ? "Yes" : "No",                                             inline: true },
        { name: "Account created", value: time(user.createdAt,   TimestampStyles.RelativeTime),                inline: true },
        { name: "Joined server",   value: target.joinedAt ? time(target.joinedAt, TimestampStyles.RelativeTime) : "Unknown", inline: true },
        { name: \`Roles (\${target.roles.cache.size - 1})\`, value: roles },
      )
      .setFooter({ text: \`Requested by \${ctx.interaction?.user.tag ?? "?"}\` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/utility/commands/avatar.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const avatarCommand: Command = {
  name: "avatar",
  description: "Show a user's avatar in full size.",
  aliases: ["av", "pfp"],
  slashCommand: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar in full size.")
    .addUserOption((o) =>
      o.setName("user").setDescription("Whose avatar to show.").setRequired(false),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getUser("user") ?? ctx.interaction?.user;
    if (!target) return ctx.reply("❌ Could not find that user.");

    const globalUrl = target.displayAvatarURL({ size: 4096, extension: "png" });
    const member    = ctx.interaction?.guild?.members.cache.get(target.id);
    const serverUrl = member?.displayAvatarURL({ size: 4096, extension: "png" });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(\`\${target.username}'s Avatar\`)
      .setImage(globalUrl)
      .setURL(globalUrl)
      .setTimestamp();

    if (serverUrl && serverUrl !== globalUrl) {
      embed.addFields(
        { name: "Server avatar", value: \`[Open](\${serverUrl})\`, inline: true },
        { name: "Global avatar", value: \`[Open](\${globalUrl})\`, inline: true },
      );
    }

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/utility/commands/invite.ts",
      content: `import { EmbedBuilder, OAuth2Scopes, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const inviteCommand: Command = {
  name: "invite",
  description: "Get the OAuth2 invite link for this bot.",
  slashCommand: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the OAuth2 invite link for this bot."),

  async execute(ctx) {
    const inviteUrl = ctx.client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.AddReactions,
      ],
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔗 Invite Link")
      .setDescription(\`[Click here to invite me!](\${inviteUrl})\`)
      .setFooter({ text: "Powered by Rexxy" });

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
  ];
}

// =============================================================================
// MODERATION PLUGIN
// =============================================================================
function moderationPlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/moderation/index.ts",
      content: `/**
 * Moderation plugin — server management with permission checks.
 *
 * Commands: /ban, /kick, /mute (timeout), /unmute, /warn, /warnings, /clear, /slowmode
 *
 * Warnings are stored in the \`warnings\` table per-guild.
 * Mute uses Discord's native timeout — no mute-role needed.
 */

import type { Plugin } from "../../core/types";
import { banCommand }      from "./commands/ban";
import { kickCommand }     from "./commands/kick";
import { muteCommand }     from "./commands/mute";
import { unmuteCommand }   from "./commands/unmute";
import { warnCommand }     from "./commands/warn";
import { warningsCommand } from "./commands/warnings";
import { clearCommand }    from "./commands/clear";
import { slowmodeCommand } from "./commands/slowmode";

const plugin: Plugin = {
  name: "moderation",
  version: "1.0.0",
  description: "Server moderation: ban, kick, mute, warn, clear, and slowmode.",
  commands: [banCommand, kickCommand, muteCommand, unmuteCommand, warnCommand, warningsCommand, clearCommand, slowmodeCommand],
  events: [],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/moderation/commands/ban.ts",
      content: `import { EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const banCommand: Command = {
  name: "ban",
  description: "Permanently ban a member from the server.",
  slashCommand: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Permanently ban a member from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) =>
      o.setName("user").setDescription("Member to ban.").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason for the ban.").setRequired(false),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getMember("user") as GuildMember | null;
    const reason = ctx.interaction?.options.getString("reason") ?? "No reason provided.";

    if (!target) return ctx.reply("❌ Could not find that member.");
    if (!target.bannable) return ctx.reply("❌ I do not have permission to ban that member.");

    await target.ban({ reason });

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔨 Member Banned")
      .addFields(
        { name: "User",   value: target.user.tag, inline: true },
        { name: "Reason", value: reason,           inline: true },
      )
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/kick.ts",
      content: `import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const kickCommand: Command = {
  name: "kick",
  description: "Kick a member from the server.",
  slashCommand: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) =>
      o.setName("user").setDescription("Member to kick.").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason for the kick.").setRequired(false),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getMember("user") as GuildMember | null;
    const reason = ctx.interaction?.options.getString("reason") ?? "No reason provided.";

    if (!target) return ctx.reply("❌ Could not find that member.");
    if (!target.kickable) return ctx.reply("❌ I do not have permission to kick that member.");

    await target.kick(reason);
    await ctx.reply(\`✅ **\${target.user.tag}** has been kicked. Reason: \${reason}\`);
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/mute.ts",
      content: `import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const muteCommand: Command = {
  name: "mute",
  description: "Timeout (mute) a member for a set duration.",
  slashCommand: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Apply a timeout so a member cannot send messages.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName("user").setDescription("Member to mute.").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("duration")
        .setDescription("Duration in minutes (1–40320, max 28 days).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason.").setRequired(false),
    ),

  async execute(ctx) {
    const target  = ctx.interaction?.options.getMember("user") as GuildMember | null;
    const minutes = ctx.interaction?.options.getInteger("duration") ?? 5;
    const reason  = ctx.interaction?.options.getString("reason") ?? "No reason provided.";

    if (!target) return ctx.reply("❌ Could not find that member.");
    if (!target.moderatable) return ctx.reply("❌ I do not have permission to timeout that member.");

    await target.timeout(minutes * 60 * 1000, reason);
    await ctx.reply(
      \`⏳ **\${target.user.tag}** muted for **\${minutes}** minute(s). Reason: \${reason}\`,
    );
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/unmute.ts",
      content: `import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/types";

export const unmuteCommand: Command = {
  name: "unmute",
  description: "Remove a timeout from a member.",
  slashCommand: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a timeout (unmute) from a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName("user").setDescription("Member to unmute.").setRequired(true),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getMember("user") as GuildMember | null;

    if (!target) return ctx.reply("❌ Could not find that member.");
    if (!target.isCommunicationDisabled()) return ctx.reply("ℹ️ That member is not currently muted.");
    if (!target.moderatable) return ctx.reply("❌ I do not have permission to unmute that member.");

    await target.timeout(null);
    await ctx.reply(\`✅ **\${target.user.tag}** has been unmuted.\`);
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/warn.ts",
      content: `import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

export const warnCommand: Command = {
  name: "warn",
  description: "Issue a warning to a member. Stored in the database.",
  slashCommand: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName("user").setDescription("Member to warn.").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason for the warning.").setRequired(true),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getUser("user");
    const reason = ctx.interaction?.options.getString("reason") ?? "";

    if (!target) return ctx.reply("❌ Could not find that user.");
    if (target.bot) return ctx.reply("❌ You cannot warn a bot.");
    if (!ctx.interaction?.guildId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (ctx.client as any).__rexxyDb as DatabaseInterface;
    await db.query(
      "INSERT INTO warnings (user_id, guild_id, reason, moderator_id) VALUES (?, ?, ?, ?)",
      [target.id, ctx.interaction.guildId, reason, ctx.interaction.user.id],
    );

    const rows = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM warnings WHERE user_id = ? AND guild_id = ?",
      [target.id, ctx.interaction.guildId],
    );
    const total = rows[0]?.count ?? 1;

    await ctx.reply(
      \`⚠️ **\${target.tag}** warned (warning #\${total}). Reason: \${reason}\`,
    );
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/warnings.ts",
      content: `import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

interface Warning {
  id: number;
  reason: string;
  moderator_id: string;
  created_at: string;
}

export const warningsCommand: Command = {
  name: "warnings",
  description: "View all warnings for a member.",
  slashCommand: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View all warnings for a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName("user").setDescription("Member to check.").setRequired(true),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getUser("user");
    if (!target || !ctx.interaction?.guildId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const rows = await db.query<Warning>(
      \`SELECT id, reason, moderator_id, created_at
       FROM warnings WHERE user_id = ? AND guild_id = ?
       ORDER BY created_at DESC LIMIT 10\`,
      [target.id, ctx.interaction.guildId],
    );

    if (rows.length === 0) return ctx.reply(\`✅ **\${target.tag}** has no warnings.\`);

    const lines = rows.map(
      (w, i) =>
        \`**\${i + 1}.** \${w.reason} — by <@\${w.moderator_id}> <t:\${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>\`,
    );

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setTitle(\`⚠️ Warnings (\${rows.length})\`)
      .setDescription(lines.join("\\n"))
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/clear.ts",
      content: `import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import type { Command } from "../../../core/types";

export const clearCommand: Command = {
  name: "clear",
  description: "Bulk-delete recent messages in this channel.",
  aliases: ["purge"],
  slashCommand: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Bulk-delete recent messages in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("Number of messages to delete (1–100).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((o) =>
      o.setName("user").setDescription("Only delete messages from this user.").setRequired(false),
    ),

  async execute(ctx) {
    const amount     = ctx.interaction?.options.getInteger("amount") ?? 10;
    const filterUser = ctx.interaction?.options.getUser("user");
    const channel    = ctx.interaction?.channel as TextChannel | null;

    if (!channel?.isTextBased()) return ctx.reply("❌ Cannot delete messages here.");

    await ctx.interaction?.deferReply({ ephemeral: true });

    const messages = await channel.messages.fetch({ limit: amount });
    const toDelete  = filterUser
      ? messages.filter((m) => m.author.id === filterUser.id)
      : messages;

    const deleted = await channel.bulkDelete(toDelete, true);

    await ctx.interaction?.editReply(
      \`🗑️ Deleted **\${deleted.size}** message(s)\${filterUser ? \` from \${filterUser.tag}\` : ""}.\`,
    );
  },
};
`,
    },
    {
      filePath: "src/plugins/moderation/commands/slowmode.ts",
      content: `import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import type { Command } from "../../../core/types";

export const slowmodeCommand: Command = {
  name: "slowmode",
  description: "Set or disable the slowmode cooldown for this channel.",
  slashCommand: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set or disable the slowmode cooldown for this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((o) =>
      o
        .setName("seconds")
        .setDescription("Cooldown in seconds (0 to disable, max 21600).")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600),
    ),

  async execute(ctx) {
    const seconds = ctx.interaction?.options.getInteger("seconds") ?? 0;
    const channel = ctx.interaction?.channel as TextChannel | null;

    if (!channel?.isTextBased() || channel.isDMBased()) {
      return ctx.reply("❌ This command can only be used in a text channel.");
    }

    await (channel as TextChannel).setRateLimitPerUser(seconds);
    await ctx.reply(
      seconds === 0
        ? "✅ Slowmode **disabled** for this channel."
        : \`✅ Slowmode set to **\${seconds}** second(s).\`,
    );
  },
};
`,
    },
  ];
}

// =============================================================================
// LEVELING PLUGIN
// =============================================================================
function levelingPlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/leveling/index.ts",
      content: `/**
 * Leveling plugin — rewards users with XP for sending messages.
 *
 * Commands: /rank, /leaderboard
 * Events:   messageCreate (XP + level-up notification)
 *
 * XP formula:  level = floor(sqrt(xp / 100))
 * Cooldown:    60 seconds between XP awards per user per guild.
 */

import type { Plugin } from "../../core/types";
import { rankCommand }        from "./commands/rank";
import { leaderboardCommand } from "./commands/leaderboard";
import { xpMessageEvent }     from "./events/xpMessage";

const plugin: Plugin = {
  name: "leveling",
  version: "1.0.0",
  description: "XP leveling with rank cards and leaderboards.",
  commands: [rankCommand, leaderboardCommand],
  events: [xpMessageEvent],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/leveling/commands/rank.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

function xpForLevel(level: number): number {
  return level * level * 100;
}

export const rankCommand: Command = {
  name: "rank",
  description: "Show your current XP and level in this server.",
  slashCommand: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show your current XP and level in this server.")
    .addUserOption((o) =>
      o.setName("user").setDescription("Another user to look up.").setRequired(false),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getUser("user") ?? ctx.interaction?.user;
    if (!target || !ctx.interaction?.guildId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const rows = await db.query<{ xp: number; level: number }>(
      "SELECT xp, level FROM user_levels WHERE user_id = ? AND guild_id = ?",
      [target.id, ctx.interaction.guildId],
    );

    const xp    = rows[0]?.xp    ?? 0;
    const level = rows[0]?.level ?? 0;
    const next  = xpForLevel(level + 1);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setTitle("📊 Rank")
      .addFields(
        { name: "Level", value: String(level),        inline: true },
        { name: "XP",    value: \`\${xp} / \${next}\`, inline: true },
      )
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/leveling/commands/leaderboard.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

interface LevelRow {
  user_id: string;
  xp: number;
  level: number;
}

export const leaderboardCommand: Command = {
  name: "leaderboard",
  description: "View the top 10 members by XP.",
  aliases: ["lb", "top"],
  slashCommand: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top 10 members by XP in this server."),

  async execute(ctx) {
    if (!ctx.interaction?.guildId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const rows = await db.query<LevelRow>(
      "SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10",
      [ctx.interaction.guildId],
    );

    if (rows.length === 0) {
      return ctx.reply("No leveling data yet. Start chatting to earn XP!");
    }

    const lines = rows.map(
      (r, i) => \`**\${i + 1}.** <@\${r.user_id}> — Level \${r.level} (\${r.xp} XP)\`,
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🏆 XP Leaderboard")
      .setDescription(lines.join("\\n"))
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/leveling/events/xpMessage.ts",
      content: `import type { Message } from "discord.js";
import type { DatabaseInterface, EventHandler } from "../../../core/types";

const XP_MIN      = 15;
const XP_MAX      = 25;
const COOLDOWN_MS = 60_000;

function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

const cooldowns = new Map<string, number>();

export const xpMessageEvent: EventHandler = {
  event: "messageCreate",

  async execute(message: Message) {
    if (message.author.bot || !message.guildId) return;

    const key = \`\${message.author.id}:\${message.guildId}\`;
    const now  = Date.now();
    if (now - (cooldowns.get(key) ?? 0) < COOLDOWN_MS) return;
    cooldowns.set(key, now);

    const gain = XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (message.client as any).__rexxyDb as DatabaseInterface | undefined;
    if (!db) return;

    const rows = await db.query<{ xp: number; level: number }>(
      "SELECT xp, level FROM user_levels WHERE user_id = ? AND guild_id = ?",
      [message.author.id, message.guildId],
    );

    const prev     = rows[0] ?? { xp: 0, level: 0 };
    const newXp    = prev.xp + gain;
    const newLevel = levelFromXp(newXp);

    await db.query(
      \`INSERT INTO user_levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = excluded.xp, level = excluded.level\`,
      [message.author.id, message.guildId, newXp, newLevel],
    );

    if (newLevel > prev.level) {
      await message.channel.send(
        \`🎉 Congrats <@\${message.author.id}>! You levelled up to **Level \${newLevel}**!\`,
      );
    }
  },
};
`,
    },
  ];
}

// =============================================================================
// ECONOMY PLUGIN
// =============================================================================
function economyPlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/economy/index.ts",
      content: `/**
 * Economy plugin — virtual currency system.
 *
 * Commands: /balance, /daily, /give
 */

import type { Plugin } from "../../core/types";
import { balanceCommand } from "./commands/balance";
import { dailyCommand }   from "./commands/daily";
import { giveCommand }    from "./commands/give";

const plugin: Plugin = {
  name: "economy",
  version: "1.0.0",
  description: "Virtual currency with daily rewards and transfers.",
  commands: [balanceCommand, dailyCommand, giveCommand],
  events: [],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/economy/commands/balance.ts",
      content: `import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

export const balanceCommand: Command = {
  name: "balance",
  description: "Check your coin balance.",
  aliases: ["bal", "coins"],
  slashCommand: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your coin balance.")
    .addUserOption((o) =>
      o.setName("user").setDescription("Another user to check.").setRequired(false),
    ),

  async execute(ctx) {
    const target = ctx.interaction?.options.getUser("user") ?? ctx.interaction?.user;
    if (!target || !ctx.interaction?.guildId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const rows = await db.query<{ balance: number }>(
      "SELECT balance FROM user_economy WHERE user_id = ? AND guild_id = ?",
      [target.id, ctx.interaction.guildId],
    );
    const balance = rows[0]?.balance ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setDescription(\`💰 Balance: **\${balance} coins**\`)
      .setTimestamp();

    await ctx.reply({ embeds: [embed] } as never);
  },
};
`,
    },
    {
      filePath: "src/plugins/economy/commands/daily.ts",
      content: `import { SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

const DAILY_AMOUNT   = 100;
const COOLDOWN_HOURS = 24;

export const dailyCommand: Command = {
  name: "daily",
  description: \`Claim your daily \${DAILY_AMOUNT} coins (24-hour cooldown).\`,
  slashCommand: new SlashCommandBuilder()
    .setName("daily")
    .setDescription(\`Claim your daily \${DAILY_AMOUNT} coins.\`),

  async execute(ctx) {
    if (!ctx.interaction?.guildId || !ctx.interaction.user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db  = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const uid = ctx.interaction.user.id;
    const gid = ctx.interaction.guildId;

    const rows = await db.query<{ balance: number; last_daily: string | null }>(
      "SELECT balance, last_daily FROM user_economy WHERE user_id = ? AND guild_id = ?",
      [uid, gid],
    );
    const current = rows[0] ?? { balance: 0, last_daily: null };
    const now     = new Date();

    if (current.last_daily) {
      const hoursSince = (now.getTime() - new Date(current.last_daily).getTime()) / 3_600_000;
      if (hoursSince < COOLDOWN_HOURS) {
        const remaining = Math.ceil(COOLDOWN_HOURS - hoursSince);
        return ctx.reply(\`⏳ Come back in **\${remaining}** hour(s) for your next daily.\`);
      }
    }

    const newBalance = current.balance + DAILY_AMOUNT;
    await db.query(
      \`INSERT INTO user_economy (user_id, guild_id, balance, last_daily) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, guild_id) DO UPDATE SET balance = excluded.balance, last_daily = excluded.last_daily\`,
      [uid, gid, newBalance, now.toISOString()],
    );

    await ctx.reply(
      \`✅ Claimed **\${DAILY_AMOUNT} coins**! New balance: **\${newBalance} coins**.\`,
    );
  },
};
`,
    },
    {
      filePath: "src/plugins/economy/commands/give.ts",
      content: `import { SlashCommandBuilder } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

export const giveCommand: Command = {
  name: "give",
  description: "Give some of your coins to another member.",
  slashCommand: new SlashCommandBuilder()
    .setName("give")
    .setDescription("Give some of your coins to another member.")
    .addUserOption((o) =>
      o.setName("user").setDescription("The recipient.").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Number of coins.").setRequired(true).setMinValue(1),
    ),

  async execute(ctx) {
    if (!ctx.interaction?.guildId || !ctx.interaction.user) return;

    const target = ctx.interaction.options.getUser("user");
    const amount = ctx.interaction.options.getInteger("amount") ?? 0;
    const gid    = ctx.interaction.guildId;
    const sid    = ctx.interaction.user.id;

    if (!target || target.bot) return ctx.reply("❌ Invalid recipient.");
    if (target.id === sid)     return ctx.reply("❌ You cannot give coins to yourself.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const rows = await db.query<{ balance: number }>(
      "SELECT balance FROM user_economy WHERE user_id = ? AND guild_id = ?",
      [sid, gid],
    );
    const balance = rows[0]?.balance ?? 0;
    if (balance < amount) return ctx.reply(\`❌ You only have **\${balance} coins**.\`);

    await db.query(
      \`INSERT INTO user_economy (user_id, guild_id, balance) VALUES (?, ?, ?)
       ON CONFLICT (user_id, guild_id) DO UPDATE SET balance = balance - ?\`,
      [sid, gid, -amount, amount],
    );
    await db.query(
      \`INSERT INTO user_economy (user_id, guild_id, balance) VALUES (?, ?, ?)
       ON CONFLICT (user_id, guild_id) DO UPDATE SET balance = balance + ?\`,
      [target.id, gid, amount, amount],
    );

    await ctx.reply(\`✅ Sent **\${amount} coins** to **\${target.tag}**!\`);
  },
};
`,
    },
  ];
}

// =============================================================================
// LOGGING PLUGIN
// =============================================================================
function loggingPlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/logging/index.ts",
      content: `/**
 * Logging plugin — automatic audit log for member and message events.
 *
 * Posts to the first text channel whose name contains "log" or "audit".
 * No commands — purely event-driven.
 */

import type { Plugin } from "../../core/types";
import { memberAddEvent }     from "./events/memberAdd";
import { memberRemoveEvent }  from "./events/memberRemove";
import { messageDeleteEvent } from "./events/messageDelete";
import { messageUpdateEvent } from "./events/messageUpdate";

const plugin: Plugin = {
  name: "logging",
  version: "1.0.0",
  description: "Audit log for joins, leaves, message edits and deletes.",
  commands: [],
  events: [memberAddEvent, memberRemoveEvent, messageDeleteEvent, messageUpdateEvent],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/logging/logChannel.ts",
      content: `import type { Guild, TextChannel } from "discord.js";

/** Returns the first text channel whose name includes "log" or "audit". */
export async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  return (guild.channels.cache.find(
    (c): c is TextChannel =>
      c.isTextBased() &&
      !c.isDMBased() &&
      (c.name.includes("log") || c.name.includes("audit")),
  ) as TextChannel | undefined) ?? null;
}
`,
    },
    {
      filePath: "src/plugins/logging/events/memberAdd.ts",
      content: `import { EmbedBuilder, GuildMember, TextChannel, time, TimestampStyles } from "discord.js";
import type { EventHandler } from "../../../core/types";
import { getLogChannel } from "../logChannel";

export const memberAddEvent: EventHandler = {
  event: "guildMemberAdd",
  async execute(member: GuildMember) {
    const ch = await getLogChannel(member.guild);
    if (!ch) return;

    await (ch as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
          .setTitle("✅ Member Joined")
          .setDescription(\`<@\${member.id}> joined the server.\`)
          .addFields({ name: "Account created", value: time(member.user.createdAt, TimestampStyles.RelativeTime) })
          .setTimestamp(),
      ],
    });
  },
};
`,
    },
    {
      filePath: "src/plugins/logging/events/memberRemove.ts",
      content: `import { EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import type { EventHandler } from "../../../core/types";
import { getLogChannel } from "../logChannel";

export const memberRemoveEvent: EventHandler = {
  event: "guildMemberRemove",
  async execute(member: GuildMember) {
    const ch = await getLogChannel(member.guild);
    if (!ch) return;

    await (ch as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
          .setTitle("🚪 Member Left")
          .setDescription(\`<@\${member.id}> left the server.\`)
          .setTimestamp(),
      ],
    });
  },
};
`,
    },
    {
      filePath: "src/plugins/logging/events/messageDelete.ts",
      content: `import { EmbedBuilder, Message, TextChannel } from "discord.js";
import type { EventHandler } from "../../../core/types";
import { getLogChannel } from "../logChannel";

export const messageDeleteEvent: EventHandler = {
  event: "messageDelete",
  async execute(message: Message) {
    if (!message.guild || message.author?.bot) return;
    const ch = await getLogChannel(message.guild);
    if (!ch) return;

    await (ch as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle("🗑️ Message Deleted")
          .addFields(
            { name: "Author",  value: message.author ? \`<@\${message.author.id}>\` : "Unknown", inline: true },
            { name: "Channel", value: \`<#\${message.channelId}>\`, inline: true },
            { name: "Content", value: message.content || "*[no text content]*" },
          )
          .setTimestamp(),
      ],
    });
  },
};
`,
    },
    {
      filePath: "src/plugins/logging/events/messageUpdate.ts",
      content: `import { EmbedBuilder, Message, TextChannel } from "discord.js";
import type { EventHandler } from "../../../core/types";
import { getLogChannel } from "../logChannel";

export const messageUpdateEvent: EventHandler = {
  event: "messageUpdate",
  async execute(oldMessage: Message, newMessage: Message) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const ch = await getLogChannel(newMessage.guild);
    if (!ch) return;

    await (ch as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("✏️ Message Edited")
          .setURL(newMessage.url)
          .addFields(
            { name: "Author",  value: \`<@\${newMessage.author.id}>\`, inline: true },
            { name: "Channel", value: \`<#\${newMessage.channelId}>\`, inline: true },
            { name: "Before",  value: oldMessage.content || "*empty*" },
            { name: "After",   value: newMessage.content || "*empty*" },
          )
          .setTimestamp(),
      ],
    });
  },
};
`,
    },
  ];
}

// =============================================================================
// WELCOME PLUGIN
// =============================================================================
function welcomePlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/welcome/index.ts",
      content: `/**
 * Welcome plugin — sends a configurable greeting when a member joins.
 *
 * Commands: /welcome set, /welcome test, /welcome disable
 *
 * Placeholders: {user}  {username}  {server}  {membercount}
 *
 * Config stored in the \`welcome_configs\` database table.
 */

import type { Plugin } from "../../core/types";
import { welcomeCommand }  from "./commands/welcome";
import { memberJoinEvent } from "./events/memberJoin";

const plugin: Plugin = {
  name: "welcome",
  version: "1.0.0",
  description: "Configurable welcome messages for new members.",
  commands: [welcomeCommand],
  events: [memberJoinEvent],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/welcome/placeholders.ts",
      content: `/**
 * Resolves {placeholder} tokens in welcome message strings.
 *
 * Supported tokens:
 *   {user}        — Discord mention (@User)
 *   {username}    — plain username
 *   {server}      — guild name
 *   {membercount} — current member count
 *
 * To add a new placeholder, pass it in the \`tokens\` map when calling
 * \`resolvePlaceholders\` — no other changes needed.
 */
export function resolvePlaceholders(
  template: string,
  tokens: Record<string, string>,
): string {
  return Object.entries(tokens).reduce(
    (str, [key, value]) => str.replaceAll(\`{\${key}}\`, value),
    template,
  );
}
`,
    },
    {
      filePath: "src/plugins/welcome/commands/welcome.ts",
      content: `import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";
import { resolvePlaceholders } from "../placeholders";

export const welcomeCommand: Command = {
  name: "welcome",
  description: "Configure the welcome message system.",
  slashCommand: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the welcome message system.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the welcome channel and message.")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Channel for welcome messages.").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("message")
            .setDescription("Message text. Placeholders: {user} {username} {server} {membercount}")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Preview the current welcome message."),
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Disable welcome messages."),
    ),

  async execute(ctx) {
    if (!ctx.interaction?.guildId || !ctx.interaction.guild) return;

    const sub = ctx.interaction.options.getSubcommand(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db  = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const gid = ctx.interaction.guildId;

    if (sub === "set") {
      const channel = ctx.interaction.options.getChannel("channel") as TextChannel;
      const message =
        ctx.interaction.options.getString("message") ??
        "Welcome {user} to **{server}**! You are member #{membercount}. 🎉";

      await db.query(
        \`INSERT INTO welcome_configs (guild_id, channel_id, message, enabled) VALUES (?, ?, ?, 1)
         ON CONFLICT (guild_id) DO UPDATE SET channel_id = excluded.channel_id, message = excluded.message, enabled = 1\`,
        [gid, channel.id, message],
      );

      const preview = resolvePlaceholders(message, {
        user:        ctx.interaction.user.toString(),
        username:    ctx.interaction.user.username,
        server:      ctx.interaction.guild.name,
        membercount: String(ctx.interaction.guild.memberCount),
      });

      await ctx.reply(\`✅ Welcome messages enabled in <#\${channel.id}>!\\n**Preview:** \${preview}\`);
    } else if (sub === "test") {
      const rows = await db.query<{ channel_id: string; message: string; enabled: number }>(
        "SELECT channel_id, message, enabled FROM welcome_configs WHERE guild_id = ?",
        [gid],
      );

      if (!rows[0] || !rows[0].enabled) {
        return ctx.reply("❌ Welcome messages not configured. Use **/welcome set** first.");
      }

      const preview = resolvePlaceholders(rows[0].message, {
        user:        ctx.interaction.user.toString(),
        username:    ctx.interaction.user.username,
        server:      ctx.interaction.guild.name,
        membercount: String(ctx.interaction.guild.memberCount),
      });

      await ctx.reply(\`**Preview:**\\n\${preview}\`);
    } else if (sub === "disable") {
      await db.query("UPDATE welcome_configs SET enabled = 0 WHERE guild_id = ?", [gid]);
      await ctx.reply("✅ Welcome messages disabled.");
    }
  },
};
`,
    },
    {
      filePath: "src/plugins/welcome/events/memberJoin.ts",
      content: `import type { GuildMember } from "discord.js";
import { TextChannel } from "discord.js";
import type { DatabaseInterface, EventHandler } from "../../../core/types";
import { resolvePlaceholders } from "../placeholders";

interface WelcomeConfig {
  channel_id: string;
  message: string;
  enabled: number;
}

export const memberJoinEvent: EventHandler = {
  event: "guildMemberAdd",

  async execute(member: GuildMember) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (member.client as any).__rexxyDb as DatabaseInterface | undefined;
    if (!db) return;

    const rows = await db.query<WelcomeConfig>(
      "SELECT channel_id, message, enabled FROM welcome_configs WHERE guild_id = ?",
      [member.guild.id],
    );

    const config = rows[0];
    if (!config || !config.enabled) return;

    const channel = member.guild.channels.cache.get(config.channel_id) as TextChannel | undefined;
    if (!channel?.isTextBased()) return;

    const text = resolvePlaceholders(config.message, {
      user:        member.toString(),
      username:    member.user.username,
      server:      member.guild.name,
      membercount: String(member.guild.memberCount),
    });

    await channel.send(text);
  },
};
`,
    },
  ];
}

// =============================================================================
// REACTION ROLES PLUGIN
// =============================================================================
function reactionRolesPlugin(): GeneratedFile[] {
  return [
    {
      filePath: "src/plugins/reaction-roles/index.ts",
      content: `/**
 * Reaction Roles plugin — self-assignable roles via message reactions.
 *
 * Commands: /reactionrole create, /reactionrole remove, /reactionrole list
 * Events:   messageReactionAdd, messageReactionRemove
 *
 * How it works:
 *   1. Admin runs /reactionrole create (channel, message ID, emoji, role).
 *   2. Members react → they receive the role.
 *   3. Members un-react → role is removed.
 *
 * Requires GuildMessageReactions intent + Partials.Message/Reaction
 * (both enabled in RexxyClient by default).
 */

import type { Plugin } from "../../core/types";
import { reactionRoleCommand } from "./commands/reactionrole";
import { reactionAddEvent }    from "./events/reactionAdd";
import { reactionRemoveEvent } from "./events/reactionRemove";

const plugin: Plugin = {
  name: "reaction-roles",
  version: "1.0.0",
  description: "Self-assignable roles via message reactions.",
  commands: [reactionRoleCommand],
  events: [reactionAddEvent, reactionRemoveEvent],
};

export default plugin;
`,
    },
    {
      filePath: "src/plugins/reaction-roles/commands/reactionrole.ts",
      content: `import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import type { Command, DatabaseInterface } from "../../../core/types";

interface RRRow {
  id: number;
  message_id: string;
  channel_id: string;
  emoji: string;
  role_id: string;
}

export const reactionRoleCommand: Command = {
  name: "reactionrole",
  description: "Manage reaction-role bindings.",
  slashCommand: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Manage reaction-role bindings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Bind a reaction emoji on a message to a role.")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Channel containing the message.").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("message_id").setDescription("ID of the target message.").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("emoji").setDescription("Emoji that triggers the role.").setRequired(true),
        )
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to assign.").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a binding by its ID.")
        .addIntegerOption((o) =>
          o.setName("id").setDescription("Binding ID from /reactionrole list.").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all bindings for this server."),
    ),

  async execute(ctx) {
    if (!ctx.interaction?.guildId) return;

    const sub = ctx.interaction.options.getSubcommand(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db  = (ctx.client as any).__rexxyDb as DatabaseInterface;
    const gid = ctx.interaction.guildId;

    if (sub === "create") {
      const channel   = ctx.interaction.options.getChannel("channel") as TextChannel;
      const messageId = ctx.interaction.options.getString("message_id", true);
      const emoji     = ctx.interaction.options.getString("emoji", true);
      const role      = ctx.interaction.options.getRole("role", true);

      const targetMsg = await channel.messages.fetch(messageId).catch(() => null);
      if (!targetMsg) return ctx.reply(\`❌ Could not find message \\\`\${messageId}\\\` in <#\${channel.id}>.\`);

      await db.query(
        "INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)",
        [gid, channel.id, messageId, emoji, role.id],
      );

      await targetMsg.react(emoji).catch(() => null);

      await ctx.reply(
        \`✅ Reaction role created!\\n**Message:** [Jump](\${targetMsg.url})\\n**Emoji:** \${emoji} → <@&\${role.id}>\`,
      );
    } else if (sub === "remove") {
      const id = ctx.interaction.options.getInteger("id", true);
      await db.query("DELETE FROM reaction_roles WHERE id = ? AND guild_id = ?", [id, gid]);
      await ctx.reply(\`✅ Binding **#\${id}** removed.\`);
    } else if (sub === "list") {
      const rows = await db.query<RRRow>(
        "SELECT id, message_id, channel_id, emoji, role_id FROM reaction_roles WHERE guild_id = ? ORDER BY id",
        [gid],
      );

      if (rows.length === 0) {
        return ctx.reply("No reaction-role bindings yet. Use **/reactionrole create** to add one.");
      }

      const lines = rows.map(
        (r) => \`**#\${r.id}** <#\${r.channel_id}> · \\\`\${r.message_id.slice(-6)}\\\` · \${r.emoji} → <@&\${r.role_id}>\`,
      );

      await ctx.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("🎭 Reaction Roles")
            .setDescription(lines.join("\\n"))
            .setTimestamp(),
        ],
      } as never);
    }
  },
};
`,
    },
    {
      filePath: "src/plugins/reaction-roles/events/reactionAdd.ts",
      content: `import type { MessageReaction, User } from "discord.js";
import type { DatabaseInterface, EventHandler } from "../../../core/types";

export const reactionAddEvent: EventHandler = {
  event: "messageReactionAdd",

  async execute(reaction: MessageReaction, user: User) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const guild = reaction.message.guild;
    if (!guild) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (reaction.client as any).__rexxyDb as DatabaseInterface | undefined;
    if (!db) return;

    const emoji = reaction.emoji.id ?? reaction.emoji.name ?? "";
    const rows  = await db.query<{ role_id: string }>(
      "SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?",
      [guild.id, reaction.message.id, emoji],
    );

    if (!rows[0]) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    await member?.roles.add(rows[0].role_id).catch(() => null);
  },
};
`,
    },
    {
      filePath: "src/plugins/reaction-roles/events/reactionRemove.ts",
      content: `import type { MessageReaction, User } from "discord.js";
import type { DatabaseInterface, EventHandler } from "../../../core/types";

export const reactionRemoveEvent: EventHandler = {
  event: "messageReactionRemove",

  async execute(reaction: MessageReaction, user: User) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const guild = reaction.message.guild;
    if (!guild) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (reaction.client as any).__rexxyDb as DatabaseInterface | undefined;
    if (!db) return;

    const emoji = reaction.emoji.id ?? reaction.emoji.name ?? "";
    const rows  = await db.query<{ role_id: string }>(
      "SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?",
      [guild.id, reaction.message.id, emoji],
    );

    if (!rows[0]) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    await member?.roles.remove(rows[0].role_id).catch(() => null);
  },
};
`,
    },
  ];
}
