import 'dotenv/config';

export class DiscordApiError extends Error {
  constructor({ endpoint, method, status, code, message }) {
    super(message);
    this.name = 'DiscordApiError';
    this.endpoint = endpoint;
    this.method = method;
    this.status = status;
    this.code = code;
  }
}

export async function DiscordRequest(endpoint, options) {
  const url = 'https://discord.com/api/v10/' + endpoint;
  if (options.body) options.body = JSON.stringify(options.body);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DHBWDiscordBot/1.0.0',
    },
    ...options
  });
  if (!res.ok) {
    const rawData = await res.text();
    let data;
    try {
      data = JSON.parse(rawData);
    } catch {
      data = { message: rawData };
    }
    throw new DiscordApiError({
      endpoint,
      method: options.method,
      status: res.status,
      code: data.code,
      message: data.message || 'Unknown Discord API error',
    });
  }
  return res;
}

export async function installGuildCommands(appId, guildId, commands) {
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  await DiscordRequest(endpoint, { method: 'PUT', body: commands });
}
