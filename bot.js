// Bezpieczne obsługi nieprzechwyconych wyjątków
process.on('unhandledRejection', err => {
    console.error('❌ UNHANDLED REJECTION:', err);
});
process.on('uncaughtException', err => {
    console.error('❌ UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

// Importy
const http = require('http');
const { Client, GatewayIntentBits, TextChannel, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
require('dotenv').config(); // Sekrety w .env, nie commituj tego pliku!

// Zmienne środowiskowe
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = process.env.CS16_SERVER_IP;
const SERVER_PORT = parseInt(process.env.CS16_SERVER_PORT, 10);
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;
const UPDATE_INTERVAL_MINUTES = parseInt(process.env.UPDATE_INTERVAL_MINUTES || '3', 10);
const PREVIOUS_STATUS_MESSAGE_ID = process.env.PREVIOUS_STATUS_MESSAGE_ID;

let statusMessage = null;

// Funkcja uciekania znaków Markdownowych
function escapeDiscordMarkdown(text) {
    // ucieka wszystkie znaki: \ ` * _ { } [ ] ( ) # + - . ! > ~ |
    return text.replace(/([\\`*_{}\[\]()#+\-.!>~|])/g, '\\$1');
}

// Inicjalizacja klienta Discorda z ograniczonymi intents
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Funkcja aktualizacji statusu serwera
async function updateServerStatusMessage() {
    if (!statusMessage) {
        console.error('❌ Status message not initialized.');
        return;
    }
    try {
        // Pobranie danych z Gamedig
        const serverInfo = await Gamedig.query({
            type: 'cs16',
            host: SERVER_IP,
            port: SERVER_PORT,
            timeout: 20000
        });

        // Budowanie listy graczy (maks. 32)
        let playerListContent = '';
        if (Array.isArray(serverInfo.players) && serverInfo.players.length > 0) {
            const sorted = serverInfo.players
                .sort((a, b) => {
                    if (a.score != null && b.score != null) return b.score - a.score;
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 32);

            sorted.forEach(p => {
                let stats = [];
                if (p.score != null) stats.push(`Fragi: ${p.score}`);
                if (p.time != null) {
                    const s = Math.floor(p.time);
                    if (s < 60) stats.push(`${s}s`);
                    else {
                        const h = Math.floor(s / 3600);
                        const m = Math.floor((s % 3600) / 60);
                        const sec = s % 60;
                        const parts = [];
                        if (h) parts.push(`${h}h`);
                        if (m || h) parts.push(`${m}m`);
                        if (sec || m || h) parts.push(`${sec}s`);
                        stats.push(`Czas: ${parts.join(' ')}`);
                    }
                }
                const safeName = escapeDiscordMarkdown(p.name);
                playerListContent += `• ${safeName}${stats.length ? ` **(${stats.join(' | ')})**` : ''}\n`;
            });

            if (serverInfo.players.length > 32) {
                const more = serverInfo.players.length - 32;
                playerListContent += `...(+${more} więcej)\n`;
            }
        } else {
            playerListContent = 'Brak graczy online.';
        }

        // Uciekanie nazwy i mapy
        const safeServerName = escapeDiscordMarkdown(serverInfo.name || '—');
        const safeMapName = escapeDiscordMarkdown(serverInfo.map || '—');

        // Tworzymy embed
        const embed = new EmbedBuilder()
            .setTitle('ZOMBIE+EXP 100 LVL by MCk199')
            .setColor(0x0099FF)
            .setDescription(
                `⭐ **Nazwa:** ${safeServerName}\n` +
                `🗺️ **Mapa:** ${safeMapName}\n` +
                `👥 **Gracze:** ${serverInfo.players.length}/${serverInfo.maxplayers}\n` +
                `🔗 **IP:** ${SERVER_IP}:${SERVER_PORT}\n\n` +
                `**Gracze Online:**\n${playerListContent}`
            )
            .addFields({
                name: '\u200b',
                value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: 'Europe/Warsaw'
                })}`
            });

        await statusMessage.edit({ embeds: [embed], content: '' });
        console.log('✅ Status updated.');

    } catch (error) {
        console.error('❌ Error querying server:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Status Serwera CS 1.6')
            .setColor(0xFF0000)
            .setDescription(
                `🔴 **Status:** Offline lub brak odpowiedzi\n` +
                `🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\`\n\n` +
                `_Błąd: ${escapeDiscordMarkdown(error.message)}_`
            )
            .addFields({
                name: '\u200b',
                value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: 'Europe/Warsaw'
                })}`
            });
        await statusMessage.edit({ embeds: [errorEmbed], content: '' });
    }
}

// Ready
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);

    // Walidacja kluczowych zmiennych
    if (!TOKEN || !SERVER_IP || isNaN(SERVER_PORT) || !STATUS_CHANNEL_ID) {
        console.error('❌ Missing or invalid environment variables.');
        process.exit(1);
    }

    // Prostki HTTP do keep-alive (usuń jeśli niepotrzebny)
    http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);

    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (!channel || !(channel instanceof TextChannel)) {
        console.error('❌ Invalid status channel ID.');
        return;
    }

    // Pobranie lub wysłanie nowej wiadomości statusu
    if (PREVIOUS_STATUS_MESSAGE_ID) {
        try {
            statusMessage = await channel.messages.fetch(PREVIOUS_STATUS_MESSAGE_ID);
        } catch {
            statusMessage = await channel.send({
                embeds: [ new EmbedBuilder().setDescription('Inicjuję status...').setColor(0xFFA500) ]
            });
        }
    } else {
        statusMessage = await channel.send({
            embeds: [ new EmbedBuilder().setDescription('Inicjuję status...').setColor(0xFFA500) ]
        });
    }

    // Pierwsza aktualizacja i interwał
    await updateServerStatusMessage();
    setInterval(updateServerStatusMessage, UPDATE_INTERVAL_MINUTES * 60000);
});

client.login(TOKEN);
