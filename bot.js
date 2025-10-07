require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ComponentType
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent // Needed for message collectors
    ]
});

// -----------------------
// TEMPLATES AND CONFIG
// -----------------------
const TEMPLATES = {
    musica: {
        roles: ['DJ', 'Cantor', 'Ouvinte'],
        categories: [{ name: '🎵 Música', channels: ['🎧-geral', '🎤-karaoke', '📀-lançamentos'] }]
    },
    animes: {
        roles: ['Otaku', 'Fã de Mangá', 'Assistente'],
        categories: [{ name: '🍙 Animes', channels: ['💬-bate-papo', '📺-episodios', '🎨-fanart'] }]
    },
    games: {
        roles: ['Jogador', 'Streamer', 'Moderador'],
        categories: [{ name: '🎮 Games', channels: ['📣-anuncios', '🔊-voz-gamers'] }]
    }
};

const FIXED_ROLES = ['Verificado', 'Homem', 'Mulher', '+18', '-18', 'Solteiro(a)', 'Namorando'];
const GAME_ROLES = ['Fortnite', 'Minecraft', 'Roblox', 'CS2', 'LoL', 'PUBG', 'Free Fire', 'Warzone', 'FIFA'];

// -----------------------
// REGISTER COMMANDS
// -----------------------
const commands = [
    new SlashCommandBuilder()
        .setName('criarservidor')
        .setDescription('Cria categorias, canais e cargos com permissões profissionais por tema.')
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
        ),
    new SlashCommandBuilder()
        .setName('excluirtudo')
        .setDescription('Exclui todas categorias, canais e cargos, exceto o canal "geral".')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('meuperfil')
        .setDescription('Mostra todos os cargos que você possui.'),
    new SlashCommandBuilder()
        .setName('criarinstagram')
        .setDescription('Cria um post simulado do Instagram com imagem, título e descrição.')
        .addAttachmentOption(option =>
            option.setName('imagem')
                .setDescription('A imagem do post')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('Título do post')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('descricao')
                .setDescription('Descrição do post')
                .setRequired(true)
        )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🚀 Registrando comandos no servidor...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Comandos registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error.message);
    }
})();

// -----------------------
// HELPER FUNCTIONS
// -----------------------
async function createRole(guild, roleName) {
    try {
        let role = guild.roles.cache.find(r => r.name === roleName);
        if (!role) {
            role = await guild.roles.create({ name: roleName, color: 'Random', reason: 'Criação automática de cargos' });
        }
        return role;
    } catch (error) {
        console.error(`❌ Erro ao criar cargo ${roleName}:`, error.message);
        throw error;
    }
}

async function createChannel(guild, name, type, parent, permissionOverwrites) {
    try {
        return await guild.channels.create({ name, type, parent, permissionOverwrites });
    } catch (error) {
        console.error(`❌ Erro ao criar canal ${name}:`, error.message);
        throw error;
    }
}

async function createVerificationChannel(guild) {
    const verifChannel = await createChannel(guild, '✅-verificacao', ChannelType.GuildText, null, [
        { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]);

    const button = new ButtonBuilder()
        .setCustomId('verificado')
        .setLabel('✅ Verificar')
        .setStyle(ButtonStyle.Success);

    await verifChannel.send({ content: 'Clique no botão para se verificar:', components: [new ActionRowBuilder().addComponents(button)] });
    return verifChannel;
}

async function createGameCategories(guild, validRoles) {
    for (const jogo of GAME_ROLES) {
        const cat = await createChannel(guild, `🎮 ${jogo}`, ChannelType.GuildCategory, null, [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
        ]);

        await createChannel(guild, `💬-${jogo.toLowerCase().replace(/\s+/g, '-')}-chat`, ChannelType.GuildText, cat.id, [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            ...validRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
        ]);

        await createChannel(guild, `🎙️-${jogo.toLowerCase().replace(/\s+/g, '-')}-voz`, ChannelType.GuildVoice, cat.id, [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] },
            ...validRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }))
        ]);
    }
}

// -----------------------
// BOT READY
// -----------------------
client.once('ready', () => {
    console.log(`✅ Bot online como ${client.user.tag}`);
    client.instagramPosts = new Map(); // Initialize Instagram posts storage
});

// -----------------------
// INTERACTIONS
// -----------------------
client.on('interactionCreate', async (interaction) => {
    const { guild, member } = interaction;

    if (interaction.isChatInputCommand()) {
        // -----------------------
        // /CRIARSERVIDOR
        // -----------------------
        if (interaction.commandName === 'criarservidor') {
            const tema = interaction.options.getString('tema');
            await interaction.deferReply({ ephemeral: true });

            try {
                const template = TEMPLATES[tema];
                if (!template) return interaction.editReply({ content: '❌ Tema inválido.' });

                // Create roles
                const roleMap = {};
                for (const roleName of [...template.roles, ...FIXED_ROLES, ...GAME_ROLES]) {
                    roleMap[roleName] = await createRole(guild, roleName);
                }
                const validRoles = Object.values(roleMap).filter(r => r && r.id);

                // Create categories and channels
                for (const cat of template.categories) {
                    const category = await createChannel(guild, cat.name, ChannelType.GuildCategory, null, [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
                    ]);

                    for (const chName of cat.channels) {
                        const type = chName.includes('voz') ? ChannelType.GuildVoice : ChannelType.GuildText;
                        const permissions = [
                            { id: guild.roles.everyone.id, deny: type === ChannelType.GuildText ? [PermissionFlagsBits.ViewChannel] : [PermissionFlagsBits.Connect] },
                            ...validRoles.map(r => ({
                                id: r.id,
                                allow: type === ChannelType.GuildText ? [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] : [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                            }))
                        ];
                        await createChannel(guild, chName, type, category.id, permissions);
                    }
                }

                // Create game-specific categories if theme is games
                if (tema === 'games') {
                    await createGameCategories(guild, validRoles);
                }

                // Create verification channel
                await createVerificationChannel(guild);

                return interaction.editReply({ content: `✅ Estrutura do tema **${tema}** criada com sucesso!` });
            } catch (err) {
                console.error('❌ Erro ao criar estrutura:', err);
                return interaction.editReply({ content: `❌ Erro ao criar a estrutura: ${err.message}` });
            }
        }

        // -----------------------
        // /EXCLUIRTUDO
        // -----------------------
        if (interaction.commandName === 'excluirtudo') {
            await interaction.deferReply({ ephemeral: true });

            const confirmButton = new ButtonBuilder()
                .setCustomId('confirmar_exclusao')
                .setLabel('Confirmar Exclusão')
                .setStyle(ButtonStyle.Danger);
            const cancelButton = new ButtonBuilder()
                .setCustomId('cancelar_exclusao')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
            const reply = await interaction.editReply({
                content: '⚠️ Tem certeza que deseja excluir todas as categorias, canais (exceto "geral") e cargos? Essa ação é irreversível!',
                components: [row]
            });

            try {
                const confirmation = await reply.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id,
                    time: 30000,
                    componentType: ComponentType.Button
                });

                if (confirmation.customId === 'cancelar_exclusao') {
                    return confirmation.update({ content: '❌ Exclusão cancelada.', components: [] });
                }

                // Proceed with deletion
                const channelsDeleted = [];
                const rolesDeleted = [];
                await Promise.all([
                    ...guild.channels.cache.map(c => {
                        if (c.name !== 'geral') {
                            channelsDeleted.push(c.name);
                            return c.delete().catch(err => console.error(`❌ Erro ao excluir canal ${c.name}:`, err.message));
                        }
                    }),
                    ...guild.roles.cache.map(r => {
                        if (!r.managed && r.name !== '@everyone') {
                            rolesDeleted.push(r.name);
                            return r.delete().catch(err => console.error(`❌ Erro ao excluir cargo ${r.name}:`, err.message));
                        }
                    })
                ]);

                return confirmation.update({
                    content: `✅ Excluído com sucesso!\nCanais: ${channelsDeleted.length}\nCargos: ${rolesDeleted.length}`,
                    components: []
                });
            } catch (err) {
                console.error('❌ Erro ao processar exclusão:', err);
                return interaction.editReply({ content: '❌ Tempo expirado ou erro ao excluir itens.', components: [] });
            }
        }

        // -----------------------
        // /MEUPERFIL
        // -----------------------
        if (interaction.commandName === 'meuperfil') {
            const memberRoles = member.roles.cache;
            const genero = memberRoles.find(r => r.name === 'Homem' || r.name === 'Mulher');
            const idade = memberRoles.find(r => r.name === '+18' || r.name === '-18');
            const status = memberRoles.find(r => r.name === 'Solteiro(a)' || r.name === 'Namorando');
            const jogos = memberRoles.filter(r => GAME_ROLES.includes(r.name));

            const embed = new EmbedBuilder()
                .setTitle(`Perfil de ${member.user.username}`)
                .setColor('Green')
                .setDescription(
                    `**Gênero:** ${genero ? genero.name : 'Não selecionado'}\n` +
                    `**Idade:** ${idade ? idade.name : 'Não selecionado'}\n` +
                    `**Status:** ${status ? status.name : 'Não selecionado'}\n` +
                    `**Jogos:** ${jogos.size > 0 ? jogos.map(j => j.name).join(', ') : 'Nenhum'}`
                );

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // -----------------------
        // /CRIARINSTAGRAM
        // -----------------------
        if (interaction.commandName === 'criarinstagram') {
            const imagem = interaction.options.getAttachment('imagem');
            const titulo = interaction.options.getString('titulo');
            const descricao = interaction.options.getString('descricao');

            if (!imagem || !titulo || !descricao) {
                return interaction.reply({ content: '❌ Forneça todos os campos: imagem, título e descrição.', ephemeral: true });
            }

            try {
                // Cria o embed simulando Instagram
                const embed = new EmbedBuilder()
                    .setTitle(titulo)
                    .setDescription(descricao)
                    .setImage(imagem.url)
                    .setColor('Blurple')
                    .setFooter({ text: '❤️ 0 curtidas | 💬 0 comentários | Reaja com 💬 para comentar' })
                    .setTimestamp()
                    .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() });

                await interaction.deferReply();
                const postMessage = await interaction.editReply({ embeds: [embed] });

                // Adiciona reações iniciais
                await postMessage.react('❤️');
                await postMessage.react('💬');

                // Armazena o post
                const postId = `${interaction.user.id}-${postMessage.id}`;
                client.instagramPosts.set(postId, {
                    message: postMessage,
                    authorId: interaction.user.id,
                    comments: []
                });

                // Cria um coletor de mensagens para comentários
                const filter = m => m.author.id === interaction.user.id;
                const collector = postMessage.channel.createMessageCollector({ filter, time: 30000 });

                collector.on('collect', async m => {
                    const postData = client.instagramPosts.get(postId);
                    if (postData) {
                        postData.comments.push(`${m.author.username}: ${m.content}`);
                        const embed = EmbedBuilder.from(postMessage.embeds[0])
                            .setFooter({
                                text: `❤️ ${postMessage.reactions.cache.get('❤️')?.count || 0} curtidas | 💬 ${postData.comments.length} comentários | Último: ${postData.comments.slice(-1)[0] || 'Nenhum'}`
                            });
                        await postMessage.edit({ embeds: [embed] });
                        await m.delete().catch(console.error);
                    }
                });

                collector.on('end', async () => {
                    const postData = client.instagramPosts.get(postId);
                    if (postData) {
                        const embed = EmbedBuilder.from(postMessage.embeds[0])
                            .setFooter({
                                text: `❤️ ${postMessage.reactions.cache.get('❤️')?.count || 0} curtidas | 💬 ${postData.comments.length} comentários | Comentários encerrados`
                            });
                        await postMessage.edit({ embeds: [embed] });
                    }
                });
            } catch (err) {
                console.error('❌ Erro ao criar post do Instagram:', err);
                await interaction.editReply({ content: `❌ Erro ao criar post: ${err.message}`, ephemeral: true });
            }
        }
    }

    // -----------------------
    // BUTTONS
    // -----------------------
    if (interaction.isButton() && interaction.customId === 'verificado') {
        try {
            const role = guild.roles.cache.find(r => r.name === 'Verificado');
            if (role) await member.roles.add(role);

            const generoMenu = new StringSelectMenuBuilder()
                .setCustomId('genero')
                .setPlaceholder('Selecione seu gênero')
                .addOptions([{ label: 'Homem', value: 'Homem' }, { label: 'Mulher', value: 'Mulher' }]);

            const idadeMenu = new StringSelectMenuBuilder()
                .setCustomId('idade')
                .setPlaceholder('Selecione sua idade')
                .addOptions([{ label: '+18', value: '+18' }, { label: '-18', value: '-18' }]);

            const statusMenu = new StringSelectMenuBuilder()
                .setCustomId('status')
                .setPlaceholder('Selecione seu status')
                .addOptions([{ label: 'Solteiro(a)', value: 'Solteiro(a)' }, { label: 'Namorando', value: 'Namorando' }]);

            const jogosMenu = new StringSelectMenuBuilder()
                .setCustomId('jogos')
                .setPlaceholder('Selecione seus jogos favoritos (até 5)')
                .setMinValues(1)
                .setMaxValues(5)
                .addOptions(GAME_ROLES.map(game => ({ label: game, value: game })));

            const embed = new EmbedBuilder()
                .setTitle('Verificação Completa')
                .setDescription('Por favor, complete sua verificação selecionando as opções abaixo.')
                .setColor('Blue');

            await interaction.reply({
                content: '✅ Você foi verificado! Escolha suas preferências abaixo:',
                embeds: [embed],
                components: [
                    new ActionRowBuilder().addComponents(generoMenu),
                    new ActionRowBuilder().addComponents(idadeMenu),
                    new ActionRowBuilder().addComponents(statusMenu),
                    new ActionRowBuilder().addComponents(jogosMenu)
                ],
                ephemeral: true
            });
        } catch (err) {
            console.error('❌ Erro ao processar botão de verificação:', err);
            await interaction.reply({ content: `❌ Erro ao processar verificação: ${err.message}`, ephemeral: true });
        }
    }

    // -----------------------
    // SELECT MENUS
    // -----------------------
    if (interaction.isStringSelectMenu()) {
        try {
            const rolesAdded = [];
            for (const value of interaction.values) {
                const role = guild.roles.cache.find(r => r.name === value);
                if (role) {
                    await member.roles.add(role);
                    rolesAdded.push(value);
                }
            }
            await interaction.reply({ content: `✅ Cargos adicionados: ${rolesAdded.join(', ')}`, ephemeral: true });
        } catch (err) {
            console.error('❌ Erro ao adicionar cargos:', err);
            await interaction.reply({ content: `❌ Erro ao adicionar cargos: ${err.message}`, ephemeral: true });
        }
    }
});

// -----------------------
// REACTION HANDLER
// -----------------------
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const message = reaction.message;
    if (message.embeds.length > 0 && message.embeds[0].footer?.text?.includes('💬 Reaja com 💬')) {
        const postId = Array.from(client.instagramPosts.keys()).find(id => client.instagramPosts.get(id).message.id === message.id);
        const postData = client.instagramPosts.get(postId);

        if (!postData) return;

        if (reaction.emoji.name === '❤️') {
            const embed = EmbedBuilder.from(message.embeds[0])
                .setFooter({
                    text: `❤️ ${message.reactions.cache.get('❤️')?.count || 0} curtidas | 💬 ${postData.comments.length} comentários | Reaja com 💬 para comentar`
                });
            await message.edit({ embeds: [embed] });
        }

        if (reaction.emoji.name === '💬' && user.id === postData.authorId) {
            await user.send('Envie seu comentário para o post no canal ou aqui (em 30s)!');
        }
    }
});

// -----------------------
// MESSAGE HANDLER FOR COMMENTS
// -----------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const posts = Array.from(client.instagramPosts?.values() || []).filter(p => p.message.channel.id === message.channel.id);
    if (posts.length === 0) return;

    const postData = posts.find(p => p.authorId === message.author.id);
    if (!postData) return;

    postData.comments.push(`${message.author.username}: ${message.content}`);
    const embed = EmbedBuilder.from(postData.message.embeds[0])
        .setFooter({
            text: `❤️ ${postData.message.reactions.cache.get('❤️')?.count || 0} curtidas | 💬 ${postData.comments.length} comentários | Último: ${postData.comments.slice(-1)[0] || 'Nenhum'}`
        });

    await postData.message.edit({ embeds: [embed] });
    await message.delete().catch(console.error);
});

client.login(process.env.DISCORD_TOKEN);