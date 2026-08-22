const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!applicationId || !token) {
  console.error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required.');
  process.exit(1);
}

const command = {
  name: 'pomodoro',
  description: '共有ポモドーロルームを作成します',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    { name: 'focus', description: '集中時間（分）', type: 4, min_value: 1, max_value: 180 },
    { name: 'break', description: '小休憩（分）', type: 4, min_value: 1, max_value: 60 },
    { name: 'long_break', description: '長休憩（分）', type: 4, min_value: 1, max_value: 120 },
    { name: 'long_break_every', description: '長休憩までの集中回数', type: 4, min_value: 2, max_value: 8 },
  ],
};

const scope = guildId ? `applications/${applicationId}/guilds/${guildId}` : `applications/${applicationId}`;
const response = await fetch(`https://discord.com/api/v10/${scope}/commands`, {
  method: 'POST',
  headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(command),
});
const result = await response.json();
if (!response.ok) {
  console.error(result);
  process.exit(1);
}
console.log(`Registered /pomodoro (${result.id}) ${guildId ? `for guild ${guildId}` : 'globally'}.`);
