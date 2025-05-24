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
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID; // ID kanału, gdzie ma być wyświetlany status
const UPDATE_INTERVAL_MINUTES = parseInt(process.env.UPDATE_INTERVAL_MINUTES || '3'); // Częstotliwość aktualizacji w minutach, domyślnie 3

// NOWA ZMIENNA ŚRODOWISKOWA: ID poprzedniej wiadomości statusu
const PREVIOUS_STATUS_MESSAGE_ID = process.env.PREVIOUS_STATUS_MESSAGE_ID;

// Zmienna globalna do przechowywania obiektu wiadomości statusu
let statusMessage = null;

// Inicjalizacja klienta Discorda
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ],
});

// Funkcja do pobierania informacji o serwerze i aktualizacji wiadomości statusu
async function updateServerStatusMessage() {
    if (!statusMessage) {
        console.error('❌ Wiadomość statusu nie została zainicjowana. Nie można zaktualizować.');
        return;
    }

    try {
        const serverInfo = await Gamedig.query({
            type: 'cs16',
            host: SERVER_IP,
            port: SERVER_PORT,
            timeout: 20000, // Zwiększony czas oczekiwania na odpowiedź serwera - 20s
            debug: true // Dodanie flagi debugowania dla Gamedig
        });

        let playerListContent = '';

        // Tworzymy nowy obiekt EmbedBuilder
        const embed = new EmbedBuilder()
            .setTitle('ZOMBIE+EXP 100 LVL by MCk199')
            .setColor(0x0099FF) // Kolor niebieski dla statusu online
            .setDescription(
                `⭐ **Nazwa:** ${serverInfo.name}\n` +
                `🗺️ **Mapa:** ${serverInfo.map}\n` +
                `👥 **Gracze:** ${serverInfo.players.length}/${serverInfo.maxplayers}\n` +
                `🔗 **IP:** ${SERVER_IP}:${SERVER_PORT}\n`
            );

        // LOGIKA TWORZENIA LISTY GRACZY
        if (serverInfo.players && serverInfo.players.length > 0) {
            const sortedPlayers = serverInfo.players.sort((a, b) => {
                if (a.score !== undefined && b.score !== undefined) {
                    return b.score - a.score;
                }
                return a.name.localeCompare(b.name);
            });

            const maxPlayersToShow = 32;
            const playersToShow = sortedPlayers.slice(0, maxPlayersToShow);

            playersToShow.forEach(p => {
                const playerName = p.name;
                let playerStats = [];

                if (p.score !== undefined) {
                    playerStats.push(`K: ${p.score}`);
                }

                if (p.time !== undefined) {
                    const totalSeconds = Math.floor(p.time);
                    let timeString;

                    if (totalSeconds < 60) {
                        timeString = `${totalSeconds}s`;
                    } else {
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        let parts = [];

                        if (hours > 0) {
                            parts.push(`${hours}h`);
                        }
                        if (minutes > 0 || hours > 0) {
                            parts.push(`${minutes}m`);
                        }
                        if (seconds > 0 || (hours > 0 || minutes > 0)) {
                            parts.push(`${seconds}s`);
                        }
                        timeString = parts.join(' ');
                    }
                    playerStats.push(`Czas: ${timeString}`);
                }

                if (playerStats.length > 0) {
                    playerListContent += `• ${playerName} **(${playerStats.join(' | ')})**\n`;
                } else {
                    playerListContent += `• ${playerName}\n`;
                }
            });

            // DZIELENIE NA KILKA PÓL, ABY NIE PRZEKROCZYĆ LIMITU 1024 ZNAKÓW
            const MAX_FIELD_LENGTH = 1024;
            const lines = playerListContent.trim().split('\n');
            let chunk = '';
            let part = 1;
            for (const line of lines) {
                if ((chunk + '\n' + line).length > MAX_FIELD_LENGTH) {
                    embed.addFields({ name: `Gracze Online (cz. ${part})`, value: chunk, inline: false });
                    part++;
                    chunk = line;
                } else {
                    chunk += (chunk ? '\n' : '') + line;
                }
            }
            if (chunk) {
                embed.addFields({ name: `Gracze Online (cz. ${part})`, value: chunk, inline: false });
            }
        } else {
            embed.addFields(
                { name: '**Gracze Online:**', value: 'Brak graczy online.', inline: false }
            );
        }

        embed.addFields(
            {
                name: '\u200b',
                value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Warsaw' })}`,
                inline: false
            }
        );

        await statusMessage.edit({ embeds: [embed], content: '' });
        console.log('✅ Status serwera w wiadomości zaktualizowany pomyślnie.');

    } catch (error) {
        console.error('❌ Wystąpił błąd podczas pobierania informacji o serwerze CS 1.6:', error.message);
        if (error.errors && Array.isArray(error.errors)) {
            error.errors.forEach((err, index) => {
                console.error(`  Błąd ${index + 1}: Typ - ${err.type}, Wiadomość - ${err.message}`);
                if (err.stack) console.error(`  Stos: ${err.stack}`);
            });
        } else if (error.stack) {
            console.error(`  Stos: ${error.stack}`);
        }

        // Embed offline/error
        const errorEmbed = new EmbedBuilder()
            .setTitle('Status Serwera Counter-Strike 1.6')
            .setColor(0xFF0000)
            .setDescription(
                `🔴 **Status:** Offline lub brak odpowiedzi\n` +
                `🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\`\n\n` +
                `_Błąd: ${error.message}_`
            )
            .addFields(
                {
                    name: '\u200b',
                    value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Warsaw' })}`,
                    inline: false
                }
            );

        await statusMessage.edit({ embeds: [errorEmbed], content: '' });
    }
}

// Zdarzenie: Bot jest gotowy i zalogowany
client.once('ready', async () => {
    console.log(`✅ Bot zalogowany jako ${client.user.tag}!`);
    console.log(`Bot będzie automatycznie aktualizować wiadomość statusu co ${UPDATE_INTERVAL_MINUTES} minuty.`);

    if (!TOKEN || !SERVER_IP || isNaN(SERVER_PORT) || !STATUS_CHANNEL_ID || isNaN(UPDATE_INTERVAL_MINUTES)) {
        console.error('BŁĄD: Brakuje lub są nieprawidłowe wymagane zmienne środowiskowe (.env).');
        process.exit(1);
    }

    // Prosty serwer webowy do hostingu
    const HOSTING_PORT = process.env.PORT || 3000;
    const hostingWebServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot Discord dziala i jest zdrowy.\n');
    });
    hostingWebServer.listen(HOSTING_PORT, () => {
        console.log(`Prosty serwer webowy nasłuchuje na porcie ${HOSTING_PORT}`);
    });

    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (!channel || !(channel instanceof TextChannel)) {
        console.error(`BŁĄD: Nie można znaleźć kanału o ID: ${STATUS_CHANNEL_ID}.`);
        return;
    }

    if (PREVIOUS_STATUS_MESSAGE_ID) {
        try {
            statusMessage = await channel.messages.fetch(PREVIOUS_STATUS_MESSAGE_ID);
            console.log(`Znaleziono poprzednią wiadomość statusu o ID: ${PREVIOUS_STATUS_MESSAGE_ID}.`);
        } catch (error) {
            console.warn('⚠️ Nie znaleziono wiadomości. Wysyłam nową.');
            statusMessage = await channel.send({ embeds: [new EmbedBuilder().setDescription('Inicjuję automatyczny status serwera...').setColor(0xFFA500)] });
            console.log(`Zaktualizuj PREVIOUS_STATUS_MESSAGE_ID na: ${statusMessage.id}`);
        }
    } else {
        statusMessage = await channel.send({ embeds: [new EmbedBuilder().setDescription('Inicjuję automatyczny status serwera...').setColor(0xFFA500)] });
        console.log(`Zaktualizuj PREVIOUS_STATUS_MESSAGE_ID na: ${statusMessage.id}`);
    }

    await updateServerStatusMessage();
    setInterval(updateServerStatusMessage, UPDATE_INTERVAL_MINUTES * 60 * 1000);
});

// Logowanie bota do Discorda
client.login(TOKEN);
