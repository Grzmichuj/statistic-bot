// Na początku pliku, po innych importach, dodaj moduł 'http':
const http = require('http');

// DODAJ EmbedBuilder do importu z discord.js
const { Client, GatewayIntentBits, TextChannel, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
require('dotenv').config(); // Wczytaj zmienne środowiskowe z pliku .env

// Pobierz zmienne środowiskowe
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = process.env.CS16_SERVER_IP;
const SERVER_PORT = parseInt(process.env.CS16_SERVER_PORT);
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;
const UPDATE_INTERVAL_MINUTES = parseInt(process.env.UPDATE_INTERVAL_MINUTES || '3');
const PREVIOUS_STATUS_MESSAGE_ID = process.env.PREVIOUS_STATUS_MESSAGE_ID;

let statusMessage = null;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function updateServerStatusMessage() {
    if (!statusMessage) return console.error('❌ Wiadomość statusu nie została zainicjowana.');

    try {
        const serverInfo = await Gamedig.query({ type: 'cs16', host: SERVER_IP, port: SERVER_PORT, timeout: 20000, debug: true });
        let playerListContent = '';

        const embed = new EmbedBuilder()
            .setTitle('ZOMBIE+EXP 100 LVL by MCk199')
            .setColor(0x0099FF)
            .setDescription(
                `⭐ **Nazwa:** ${serverInfo.name}\n` +
                `🗺️ **Mapa:** ${serverInfo.map}\n` +
                `👥 **Gracze:** ${serverInfo.players.length}/${serverInfo.maxplayers}\n` +
                `🔗 **IP:** ${SERVER_IP}:${SERVER_PORT}\n`
            );

        if (serverInfo.players && serverInfo.players.length > 0) {
            const sortedPlayers = serverInfo.players.sort((a, b) => (
                a.score !== undefined && b.score !== undefined ? b.score - a.score : a.name.localeCompare(b.name)
            ));
            const maxPlayersToShow = 32;
            const playersToShow = sortedPlayers.slice(0, maxPlayersToShow);

            playersToShow.forEach(p => {
                let stats = [];
                if (p.score !== undefined) stats.push(`K: ${p.score}`);
                if (p.time !== undefined) {
                    const s = Math.floor(p.time);
                    if (s < 60) stats.push(`${s}s`);
                    else {
                        const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
                        const parts = [];
                        if (h) parts.push(`${h}h`);
                        if (m || h) parts.push(`${m}m`);
                        if (sec || m || h) parts.push(`${sec}s`);
                        stats.push(`Czas: ${parts.join(' ')}`);
                    }
                }
                playerListContent += stats.length ? `• ${p.name} **(${stats.join(' | ')})**\n` : `• ${p.name}\n`;
            });

            // Podział na pola bez wizualnego oddzielenia
            const lines = playerListContent.trim().split('\n');
            const MAX_FIELD_LEN = 1024;
            let chunk = '';
            let part = 1;
            for (const line of lines) {
                if ((chunk + '\n' + line).length > MAX_FIELD_LEN) {
                    embed.addFields({
                        name: part === 1 ? '**Gracze Online:**' : '\u200b',
                        value: chunk,
                        inline: false
                    });
                    part++;
                    chunk = line;
                } else chunk += (chunk ? '\n' : '') + line;
            }
            if (chunk) embed.addFields({ name: part === 1 ? '**Gracze Online:**' : '\u200b', value: chunk, inline: false });
        } else {
            embed.addFields({ name: '**Gracze Online:**', value: 'Brak graczy online.', inline: false });
        }

        embed.addFields({ name: '\u200b', value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'Europe/Warsaw', hour12:false })}`, inline: false });

        await statusMessage.edit({ embeds: [embed], content: '' });
    } catch (e) {
        console.error('Błąd:', e.message);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Status Serwera Counter-Strike 1.6')
            .setColor(0xFF0000)
            .setDescription(`🔴 **Status:** Offline\n🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\`\n
_Błąd: ${e.message}_`)
            .addFields({ name: '\u200b', value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Warsaw',hour12:false})}`, inline: false });
        await statusMessage.edit({ embeds: [errorEmbed], content: '' });
    }
}

client.once('ready', async () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    if (!TOKEN || !SERVER_IP || isNaN(SERVER_PORT) || !STATUS_CHANNEL_ID) process.exit(1);

    // Prosty HTTP do hostingu
    const HOST_PORT = process.env.PORT || 3000;
    http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(HOST_PORT);

    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (!channel || !(channel instanceof TextChannel)) return;

    if (PREVIOUS_STATUS_MESSAGE_ID) {
        try { statusMessage = await channel.messages.fetch(PREVIOUS_STATUS_MESSAGE_ID); }
        catch { statusMessage = await channel.send({ embeds: [new EmbedBuilder().setDescription('Inicjuję status...').setColor(0xFFA500)] }); }
    } else {
        statusMessage = await channel.send({ embeds: [new EmbedBuilder().setDescription('Inicjuję status...').setColor(0xFFA500)] });
    }

    await updateServerStatusMessage();
    setInterval(updateServerStatusMessage, UPDATE_INTERVAL_MINUTES * 60000);
});

client.login(TOKEN);

