require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('criarservidor')
    .setDescription('Cria categorias e canais de acordo com o tema escolhido.')
    .addStringOption(option =>
      option
        .setName('tema')
        .setDescription('Tema do servidor')
        .setRequired(true)
        .addChoices(
          { name: '🎵 Música', value: 'musica' },
          { name: '🍙 Animes', value: 'animes' },
          { name: '🎮 Games', value: 'games' }
        )
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🚀 Registrando comandos de barra (/)...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Comandos registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();
