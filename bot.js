// Na początku pliku, po innych importach, dodaj moduł 'http':
const http = require('http');

// DODAJ EmbedBuilder do importu z discord.js
const { Client, GatewayIntentBits, TextChannel, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
require('dotenv').config(); // Wczytaj zmienne środowiskowe

// Pobierz zmienne środowiskowe
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = process.env.CS16_SERVER_IP;
const SERVER_PORT = parseInt(process.env.CS16_SERVER_PORT);
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;
const UPDATE_INTERVAL_MINUTES = parseInt(process.env.UPDATE_INTERVAL_MINUTES || '3');
const PREVIOUS_STATUS_MESSAGE_ID = process.env.PREVIOUS_STATUS_MESSAGE_ID;

let statusMessage = null;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

async function updateServerStatusMessage() {
    if (!statusMessage) return console.error('❌ Status message not initialized.');
    try {
        const serverInfo = await Gamedig.query({ type: 'cs16', host: SERVER_IP, port: SERVER_PORT, timeout: 20000 });
        // Budowanie listy graczy
        let playerListContent = '';
        if (serverInfo.players && serverInfo.players.length > 0) {
            const sorted = serverInfo.players.sort((a, b) => {
                if (a.score != null && b.score != null) return b.score - a.score;
                return a.name.localeCompare(b.name);
            }).slice(0, 32);
            sorted.forEach(p => {
                let stats = [];
                if (p.score != null) stats.push(`K: ${p.score}`);
                if (p.time != null) {
                    const s = Math.floor(p.time);
                    if (s < 60) stats.push(`${s}s`);
                    else {
                        const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
                        let parts = [];
                        if (h) parts.push(`${h}h`);
                        if (m || h) parts.push(`${m}m`);
                        if (sec || m || h) parts.push(`${sec}s`);
                        stats.push(`Czas: ${parts.join(' ')}`);
                    }
                }
                playerListContent += `• ${p.name}${stats.length ? ` **(${stats.join(' | ')})**` : ''}\n`;
            });
            if (serverInfo.players.length > 32) {
                const more = serverInfo.players.length - 32;
                playerListContent += `...(+${more} więcej)\n`;
            }
        } else {
            playerListContent = 'Brak graczy online.';
        }

        // Tworzymy embed z całą listą w opisie
        const embed = new EmbedBuilder()
            .setTitle('ZOMBIE+EXP 100 LVL by MCk199')
            .setColor(0x0099FF)
            .setDescription(
                `⭐ **Nazwa:** ${serverInfo.name}\n` +
                `🗺️ **Mapa:** ${serverInfo.map}\n` +
                `👥 **Gracze:** ${serverInfo.players.length}/${serverInfo.maxplayers}\n` +
                `🔗 **IP:** ${SERVER_IP}:${SERVER_PORT}\n\n` +
                `**Gracze Online:**\n${playerListContent}`
            )
            .addFields({
                name: '\u200b',
                value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false, timeZone:'Europe/Warsaw'})}`
            });

        await statusMessage.edit({ embeds: [embed], content: '' });
        console.log('✅ Status updated.');
    } catch (error) {
        console.error('Error querying server:', error.message);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Status Serwera CS 1.6')
            .setColor(0xFF0000)
            .setDescription(
                `🔴 **Status:** Offline lub brak odpowiedzi\n` +
                `🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\`\n
` +
                `_Błąd: ${error.message}_`
            )
            .addFields({ name: '\u200b', value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Europe/Warsaw'})}` });
        await statusMessage.edit({ embeds: [errorEmbed], content: '' });
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    if (!TOKEN || !SERVER_IP || isNaN(SERVER_PORT) || !STATUS_CHANNEL_ID) process.exit(1);

    // Lekki serwer HTTP do hostingu
    http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(process.env.PORT || 3000);

    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (!channel || !(channel instanceof TextChannel)) return console.error('Invalid channel');

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
