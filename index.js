const { Client, GatewayIntentBits, Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Collection } = require('discord.js');
const { DateTime } = require('luxon');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
    ]
});

let giveaways = new Collection(); // key: giveaway ID, value: { endDateTime, winners, prize, participants }

client.once('ready', () => {
    console.log('Bot đã sẵn sàng!');

    setInterval(async () => {
        const now = DateTime.now().setZone('Asia/Ho_Chi_Minh');
        for (const [giveawayID, giveaway] of giveaways) {
            if (now > giveaway.endDateTime) {
                await endGiveaway(giveawayID);
            }
        }
    }, 60000); // Kiểm tra mỗi phút
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!giveaway')) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('Bạn không có quyền để tạo giveaway');
        }

        const openFormButton = new ButtonBuilder()
            .setCustomId('open_giveaway_modal')
            .setLabel('Tạo Giveaway')
            .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder().addComponents(openFormButton);

        await message.reply({
            content: 'Nhấn nút bên dưới để mở biểu mẫu tạo giveaway:',
            components: [actionRow]
        });
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'open_giveaway_modal') {
        const modal = new ModalBuilder()
            .setCustomId('giveaway_modal')
            .setTitle('Tạo Giveaway');

        const endTimeInput = new TextInputBuilder()
            .setCustomId('end_time')
            .setLabel('Giờ kết thúc (HH:MM)')
            .setStyle(TextInputStyle.Short);

        const endDateInput = new TextInputBuilder()
            .setCustomId('end_date')
            .setLabel('Ngày kết thúc (DD/MM/YYYY)')
            .setStyle(TextInputStyle.Short);

        const winnersInput = new TextInputBuilder()
            .setCustomId('winners')
            .setLabel('Số lượng người chiến thắng')
            .setStyle(TextInputStyle.Short);

        const prizeInput = new TextInputBuilder()
            .setCustomId('prize')
            .setLabel('Giải thưởng')
            .setStyle(TextInputStyle.Paragraph);

        const actionRow1 = new ActionRowBuilder().addComponents(endTimeInput);
        const actionRow2 = new ActionRowBuilder().addComponents(endDateInput);
        const actionRow3 = new ActionRowBuilder().addComponents(winnersInput);
        const actionRow4 = new ActionRowBuilder().addComponents(prizeInput);

        modal.addComponents(actionRow1, actionRow2, actionRow3, actionRow4);

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'giveaway_modal') {
        const endTime = interaction.fields.getTextInputValue('end_time');
        const endDate = interaction.fields.getTextInputValue('end_date');
        const winners = parseInt(interaction.fields.getTextInputValue('winners'), 10);
        const prize = interaction.fields.getTextInputValue('prize');

        // Sửa lại định dạng thời gian
        const endDateTime = DateTime.fromFormat(`${endDate} ${endTime}`, 'dd/MM/yyyy HH:mm', { zone: 'Asia/Ho_Chi_Minh' });

        // Kiểm tra định dạng thời gian hợp lệ
        if (!endDateTime.isValid) {
            return interaction.reply({ content: 'Ngày giờ không hợp lệ. Vui lòng thử lại.', ephemeral: true });
        }

        const embedMessage = await interaction.reply({ content: '@everyone Giveaway đang được tạo...', fetchReply: true });
        giveaways.set(embedMessage.id, {
            endDateTime,
            winners,
            prize,
            participants: new Set()
        });

        const joinButton = new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('Tham gia Giveaway')
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(joinButton);

        const giveawayEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Giveaway kìa mọi người tham gia ngay !!')
            .setDescription('Dưới đây là thông tin của giveaway:')
            .addFields(
                { name: 'Giải thưởng', value: prize, inline: false },
                { name: 'Ngày kết thúc', value: endDate, inline: true },
                { name: 'Giờ kết thúc', value: endTime, inline: true },
                { name: 'Số lượng người chiến thắng', value: winners.toString(), inline: true },
                { name: 'Số lượng người tham gia', value: '0', inline: true }
            )
            .setTimestamp();

        await embedMessage.edit({ content: '@everyone Giveaway đã được tạo!', embeds: [giveawayEmbed], components: [actionRow] });
        await interaction.followUp({ content: 'Giveaway đã được tạo thành công!', ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'join_giveaway') {
        const giveaway = giveaways.get(interaction.message.id);
        if (giveaway) {
            try {
                const userId = interaction.user.id;
                if (giveaway.participants.has(userId)) {
                    giveaway.participants.delete(userId);
                    await interaction.reply({ content: 'Bạn đã thoát khỏi giveaway.', ephemeral: true });
                } else {
                    giveaway.participants.add(userId);
                    await interaction.reply({ content: 'Bạn đã tham gia giveaway!', ephemeral: true });
                }

                const updatedEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Giveaway kìa mọi người tham gia ngay !!')
                    .setDescription('Dưới đây là thông tin của giveaway:')
                    .addFields(
                        { name: 'Giải thưởng', value: giveaway.prize, inline: false },
                        { name: 'Ngày kết thúc', value: giveaway.endDateTime.toFormat('dd/MM/yyyy'), inline: true },
                        { name: 'Giờ kết thúc', value: giveaway.endDateTime.toFormat('HH:mm'), inline: true },
                        { name: 'Số lượng người chiến thắng', value: giveaway.winners.toString(), inline: true },
                        { name: 'Số lượng người tham gia', value: giveaway.participants.size.toString(), inline: true }
                    )
                    .setTimestamp();

                try {
                    // Cập nhật tin nhắn với embed mới
                    await interaction.message.edit({ embeds: [updatedEmbed] });
                } catch (error) {
                    console.error('Failed to update message embed:', error);
                }
            } catch (error) {
                console.error('Button interaction handling error:', error);
            }
        } else {
            await interaction.reply({ content: 'Giveaway không tồn tại hoặc đã kết thúc.', ephemeral: true });
        }
    }
});

async function endGiveaway(giveawayID) {
    const giveaway = giveaways.get(giveawayID);
    if (!giveaway) return;

    const participants = Array.from(giveaway.participants);
    const winners = [];
    for (let i = 0; i < giveaway.winners; i++) {
        if (participants.length === 0) break;
        const winnerIndex = Math.floor(Math.random() * participants.length);
        winners.push(participants.splice(winnerIndex, 1)[0]);
    }

    const serverId = process.env.SERVER_ID;
    const channelId = process.env.CHANNEL_ID;

    const guild = client.guilds.cache.get(serverId);
    const channel = guild ? await guild.channels.fetch(channelId) : null;

    if (channel && channel.isTextBased()) {
        const winnerMentions = winners.map(id => `<@${id}>`).join(' ');
        const endEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Giveaway Đã Kết Thúc!')
            .setDescription(`Người chiến thắng là: ${winnerMentions}`)
            .setTimestamp();

        // Gửi tin nhắn mention @everyone và embed thông báo kết thúc giveaway
        await channel.send('@everyone');
        await channel.send({ embeds: [endEmbed] });
    }

    giveaways.delete(giveawayID);
}

client.login(process.env.BOT_TOKEN);
