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
            timeout: 5000 // Czas oczekiwania na odpowiedź serwera (5 sekund)
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

            const maxPlayersToShow = 33;
            const playersToShow = sortedPlayers.slice(0, maxPlayersToShow);

            playersToShow.forEach(p => {
                const playerName = p.name;
                let playerStats = [];

                if (p.score !== undefined) {
                    playerStats.push(`Fragi: ${p.score}`);
                }

                // <<< ZMIENIONA LOGIKA DLA CZASU GRACZA >>>
                if (p.time !== undefined) {
                    const totalSeconds = Math.floor(p.time);

                    let timeString;

                    if (totalSeconds < 60) {
                        // Jeśli poniżej minuty, wyświetl tylko sekundy
                        timeString = `${totalSeconds}s`;
                    } else {
                        // Oblicz godziny, minuty i sekundy
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;

                        let parts = [];

                        if (hours > 0) {
                            parts.push(`${hours}h`);
                        }
                        
                        // Wyświetl minuty, jeśli są godziny lub jeśli minuty są > 0
                        if (minutes > 0 || hours > 0) {
                            parts.push(`${minutes}m`);
                        }

                        // Wyświetl sekundy, jeśli są > 0, LUB jeśli są godziny/minuty i sekundy = 0
                        if (seconds > 0 || (hours > 0 || minutes > 0)) {
                            parts.push(`${seconds}s`);
                        }
                        
                        timeString = parts.join(' ');
                    }
                    playerStats.push(`Czas: ${timeString}`);
                }
                // <<< KONIEC ZMIANY >>>

                // Formatowanie: Nick bez pogrubienia, statystyki w nawiasie pogrubione
                if (playerStats.length > 0) {
                    playerListContent += `• ${playerName} **(${playerStats.join(' | ')})**\n`;
                } else {
                    playerListContent += `• ${playerName}\n`;
                }
            });

            if (serverInfo.players.length > maxPlayersToShow) {
                playerListContent += `\n(+${serverInfo.players.length - maxPlayersToShow} więcej...)\n`;
            }

            // Dodajemy pole dla listy graczy, nagłówek "Gracze online:" pogrubiony
            embed.addFields(
                { name: '**Gracze Online:**', value: playerListContent, inline: false }
            );

        } else {
            // Jeśli brak graczy, również dodajemy pole, nagłówek "Gracze online:" pogrubiony
            embed.addFields(
                { name: '**Gracze Online:**', value: 'Brak graczy online.', inline: false }
            );
        }

        // Ostatnia aktualizacja jako nowe pole, pogrubiona
        embed.addFields(
            {
                name: '\u200b', // Pusta nazwa pola dla lepszego wyglądu
                value: `**Ostatnia Aktualizacja:** ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Warsaw' })}`,
                inline: false
            }
        );


        // Wysyłamy / edytujemy wiadomość, używając obiektu embed
        await statusMessage.edit({ embeds: [embed], content: '' });
        console.log('✅ Status serwera w wiadomości zaktualizowany pomyślnie.');

    } catch (error) {
        console.error('❌ Wystąpił błąd podczas pobierania informacji o serwerze CS 1.6:', error.message);
        // Tworzymy embed dla statusu offline/błędu
        const errorEmbed = new EmbedBuilder()
            .setTitle('Status Serwera Counter-Strike 1.6')
            .setColor(0xFF0000) // Kolor czerwony dla statusu offline
            .setDescription(
                `🔴 **Status:** Offline lub brak odpowiedzi\n` +
                `🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\``
            )
            // Ostatnia aktualizacja jako nowe pole, pogrubiona
            .addFields(
                {
                    name: '\u200b', // Pusta nazwa pola
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

    // WALIDACJA ZMIENNYCH ŚRODOWISKOWYCH:
    if (!TOKEN || !SERVER_IP || isNaN(SERVER_PORT) || !STATUS_CHANNEL_ID || isNaN(UPDATE_INTERVAL_MINUTES)) {
        console.error('BŁĄD: Brakuje lub są nieprawidłowe wymagane zmienne środowiskowe (.env). Upewnij się, że plik .env zawiera DISCORD_TOKEN, CS16_SERVER_IP, CS16_SERVER_PORT, STATUS_CHANNEL_ID i UPDATE_INTERVAL_MINUTES.');
        process.exit(1);
    }

    // --- ROZWIĄZANIE PROBLEMU Z HOSTINGIEM ---
    const HOSTING_PORT = process.env.PORT || 3000;
    const hostingWebServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot Discord dziala i jest zdrowy.\n');
    });
    hostingWebServer.listen(HOSTING_PORT, () => {
        console.log(`Prosty serwer webowy (do kontroli hostingu) nasłuchuje na porcie ${HOSTING_PORT}`);
        console.log('Ten serwer służy wyłącznie do sprawdzania stanu przez platformę hostingową. Funkcjonalność bota Discord NIE jest od niego zależna.');
    });
    // --- KONIEC KODU ROZWIĄZUJĄCEGO PROBLEM Z HOSTINGIEM ---


    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);

    if (!channel || !(channel instanceof TextChannel)) {
        console.error(`BŁĄD: Nie można znaleźć kanału o ID: ${STATUS_CHANNEL_ID} lub nie jest to kanał tekstowy.`);
        return;
    }

    // ***** LOGIKA: Szukanie i aktualizowanie istniejącej wiadomości *****
    if (PREVIOUS_STATUS_MESSAGE_ID) {
        try {
            const fetchedMessage = await channel.messages.fetch(PREVIOUS_STATUS_MESSAGE_ID);
            statusMessage = fetchedMessage;
            console.log(`Znaleziono poprzednią wiadomość statusu o ID: ${PREVIOUS_STATUS_MESSAGE_ID}. Będę ją aktualizować.`);
        } catch (error) {
            console.warn(`⚠️ Nie udało się znaleźć lub odczytać poprzedniej wiadomości o ID: ${PREVIOUS_STATUS_MESSAGE_ID}. Możliwe, że została usunięta lub ID jest błędne. Wysyłam nową wiadomość.`);
            // Wysyłamy nową wiadomość (jako embed)
            statusMessage = await channel.send({
                embeds: [new EmbedBuilder().setDescription('Inicjuję automatyczny status serwera...').setColor(0xFFA500)]
            });
            console.log(`Wysłano nową wiadomość statusu o ID: ${statusMessage.id}. PROSZĘ ZAKTUALIZOWAĆ LUB DODAĆ ZMIENNĄ PREVIOUS_STATUS_MESSAGE_ID W PLIKU .env I USTAWIĆ JĄ NA: ${statusMessage.id}`);
        }
    } else {
        // Wysyłamy początkową wiadomość (jako embed)
        statusMessage = await channel.send({
            embeds: [new EmbedBuilder().setDescription('Inicjuję automatyczny status serwera...').setColor(0xFFA500)]
        });
        console.log(`Wysłano początkową wiadomość statusu w kanale ${channel.name} (ID: ${statusMessage.id}). ABY ZAPOBIEGAĆ WYSYŁANIU NOWYCH WIADOMOŚCI PO RESTARCIE, PROSZĘ DODAĆ ZMIENNĄ PREVIOUS_STATUS_MESSAGE_ID W PLIKU .env I USTAWIĆ JĄ NA: ${statusMessage.id}`);
    }
    // ***** KONIEC LOGIKI *****


    // Natychmiastowa pierwsza aktualizacja
    await updateServerStatusMessage();

    // Ustaw interwał dla regularnych aktualizacji
    setInterval(updateServerStatusMessage, UPDATE_INTERVAL_MINUTES * 60 * 1000);
});

// Logowanie bota do Discorda
client.login(TOKEN);
