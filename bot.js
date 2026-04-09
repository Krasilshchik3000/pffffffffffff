const { Telegraf } = require('telegraf');
const Parser = require('rss-parser');
const http = require('http');

// --- Config ---
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) { console.error('BOT_TOKEN is required'); process.exit(1); }

const PODCAST_ID = process.env.PODCAST_ID || '1371411915';
const ADMIN_IDS = (process.env.ADMIN_IDS || '869587').split(',').map(Number);
const NOTIFY_CHAT_ID = process.env.NOTIFY_CHAT_ID || null; // optional: separate channel
const EPISODE_RSS_URL = process.env.EPISODE_RSS_URL || 'https://feeds.transistor.fm/8ad5c0b4-9622-4e86-ba14-2a2e436f68b3';

// All Apple Podcasts / iTunes Store territories (ISO 3166-1 alpha-2)
// We check every store to never miss a review
const COUNTRY_CODES = [
    'ru', 'ua', 'by', 'kz', 'uz', 'kg', 'tj', 'tm', 'az', 'ge', 'am', 'md',
    'us', 'gb', 'ca', 'au', 'nz', 'ie',
    'de', 'fr', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'at', 'lu',
    'se', 'no', 'dk', 'fi', 'is',
    'pl', 'cz', 'hu', 'sk', 'si', 'hr', 'bg', 'ro',
    'lt', 'lv', 'ee',
    'rs', 'me', 'mk', 'ba', 'al',
    'il', 'tr', 'sa', 'ae', 'eg', 'qa', 'kw', 'bh', 'om', 'jo', 'lb',
    'za', 'ng', 'ke',
    'in', 'jp', 'kr', 'cn', 'sg', 'my', 'id', 'ph', 'th', 'vn', 'hk', 'tw',
    'br', 'mx', 'ar', 'cl', 'co', 'pe',
    'gr', 'cy', 'mt',
];

// --- In-memory state ---
const seenReviewIds = new Set();
let lastEpisodeGuid = null;
let botReady = false;

const bot = new Telegraf(BOT_TOKEN);
const rssParser = new Parser();

// --- Helpers ---

function isAdmin(ctx) {
    return ADMIN_IDS.includes(ctx.from?.id);
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stars(rating) {
    const n = parseInt(rating) || 0;
    return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function formatDate(isoString) {
    if (!isoString) return '?';
    const d = new Date(isoString);
    return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatReviewHtml(review) {
    const title = escapeHtml(review.title);
    const author = escapeHtml(review.author);
    const text = escapeHtml(review.content);
    const cc = (review.countryCode || '??').toUpperCase();
    const date = formatDate(review.updated);
    const rating = stars(review.rating);

    return `<b>${title}</b>\n${rating}\n${author} · ${cc} · ${date}\n\n${text}`;
}

async function sendNotification(text, parseMode = 'HTML') {
    const chatId = NOTIFY_CHAT_ID || null;
    if (!chatId) {
        console.log('No NOTIFY_CHAT_ID set, skipping notification');
        return;
    }
    try {
        await bot.telegram.sendMessage(chatId, text, { parse_mode: parseMode });
    } catch (err) {
        console.error(`Failed to send notification: ${err.message}`);
    }
}

// --- iTunes Reviews RSS ---

async function fetchReviewsForCountry(countryCode) {
    const url = `https://itunes.apple.com/${countryCode}/rss/customerreviews/id=${PODCAST_ID}/sortby=mostrecent/json`;
    try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) return [];
        const data = await resp.json();
        const entries = data?.feed?.entry || [];
        return entries
            .filter(e => e.author) // skip metadata entry
            .map(e => ({
                id: e.id?.label,
                title: e.title?.label || '',
                author: e.author?.name?.label || 'Аноним',
                content: e.content?.label || '',
                rating: e['im:rating']?.label || '0',
                updated: e.updated?.label || '',
            }));
    } catch (err) {
        // Silently skip — country may have no reviews or be unreachable
        return [];
    }
}

async function fetchAllReviews() {
    const allReviews = [];
    // Fetch countries in batches of 8 to balance speed and politeness
    for (let i = 0; i < COUNTRY_CODES.length; i += 8) {
        const batch = COUNTRY_CODES.slice(i, i + 8);
        const results = await Promise.all(
            batch.map(async (cc) => {
                const reviews = await fetchReviewsForCountry(cc);
                return reviews.map(r => ({ ...r, countryCode: cc }));
            })
        );
        allReviews.push(...results.flat());
        // Small delay between batches
        if (i + 8 < COUNTRY_CODES.length) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    // Deduplicate by review ID
    const seen = new Set();
    return allReviews.filter(r => {
        if (!r.id || seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
}

// --- Review monitoring ---

async function initializeReviewBaseline() {
    console.log('Initializing review baseline...');
    const reviews = await fetchAllReviews();
    for (const r of reviews) {
        seenReviewIds.add(r.id);
    }
    console.log(`Baseline: ${seenReviewIds.size} reviews marked as seen across ${COUNTRY_CODES.length} countries`);
}

async function checkForNewReviews() {
    if (!botReady) return;
    console.log(`[${new Date().toISOString()}] Checking for new reviews...`);
    try {
        const reviews = await fetchAllReviews();
        const newReviews = reviews.filter(r => !seenReviewIds.has(r.id));

        if (newReviews.length === 0) {
            console.log('No new reviews found');
            return;
        }

        console.log(`Found ${newReviews.length} new review(s)!`);

        // Sort by date (oldest first so they appear in order)
        newReviews.sort((a, b) => new Date(a.updated) - new Date(b.updated));

        for (const review of newReviews) {
            const msg = `🆕 Новый отзыв!\n\n${formatReviewHtml(review)}`;
            await sendNotification(msg);
            seenReviewIds.add(review.id);
            // Delay between messages
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error('Error checking reviews:', err.message);
    }
}

// --- Episode monitoring ---

async function initializeEpisodeBaseline() {
    console.log('Initializing episode baseline...');
    try {
        const feed = await rssParser.parseURL(EPISODE_RSS_URL);
        if (feed.items?.length > 0) {
            lastEpisodeGuid = feed.items[0].guid;
            console.log(`Baseline episode: "${feed.items[0].title}" (guid: ${lastEpisodeGuid})`);
        }
    } catch (err) {
        console.error('Failed to initialize episode baseline:', err.message);
    }
}

async function checkForNewEpisodes() {
    if (!botReady) return;
    console.log(`[${new Date().toISOString()}] Checking for new episodes...`);
    try {
        const feed = await rssParser.parseURL(EPISODE_RSS_URL);
        if (!feed.items?.length) return;

        const latest = feed.items[0];
        if (latest.guid === lastEpisodeGuid) {
            console.log('No new episodes');
            return;
        }

        // Skip trailers and very short items
        const title = (latest.title || '').toLowerCase();
        if (title.includes('трейлер') || title.includes('trailer')) {
            console.log(`Skipping trailer: "${latest.title}"`);
            lastEpisodeGuid = latest.guid;
            return;
        }

        console.log(`New episode detected: "${latest.title}"`);
        lastEpisodeGuid = latest.guid;

        const date = latest.pubDate ? formatDate(latest.pubDate) : '';
        const msg = `🎙 <b>Вышел новый выпуск!</b>\n\n${escapeHtml(latest.title)}\n📅 ${date}`;
        await sendNotification(msg);

    } catch (err) {
        console.error('Error checking episodes:', err.message);
    }
}

// --- Bot commands ---

bot.start(async (ctx) => {
    ctx.reply(
        'Привет! Я бот для отзывов подкаста "Два по цене одного".\n\n' +
        'Команды:\n' +
        '/reviews — последние отзывы из Apple Podcasts\n' +
        '/status — статус мониторинга\n' +
        '/help — справка'
    );
});

bot.help((ctx) => {
    let msg =
        'Команды:\n' +
        '/reviews — собрать и показать последние отзывы\n' +
        '/status — статус бота и мониторинга\n' +
        '/help — эта справка';
    if (isAdmin(ctx)) {
        msg += '\n\nАдмин:\n' +
            '/check — принудительная проверка новых отзывов\n' +
            '/check_episodes — принудительная проверка новых эпизодов\n' +
            '/set_notify — установить этот чат для уведомлений';
    }
    ctx.reply(msg);
});

bot.command('reviews', async (ctx) => {
    try {
        await ctx.reply(`🔍 Собираю отзывы из ${COUNTRY_CODES.length} стран...`);

        const reviews = await fetchAllReviews();

        if (reviews.length === 0) {
            await ctx.reply('Отзывов не найдено.');
            return;
        }

        // Sort by date, newest first
        reviews.sort((a, b) => new Date(b.updated) - new Date(a.updated));

        // Send up to 20 latest
        const toShow = reviews.slice(0, 20);
        await ctx.reply(`Найдено ${reviews.length} отзывов. Показываю последние ${toShow.length}:`);

        for (const review of toShow) {
            try {
                await ctx.reply(formatReviewHtml(review), { parse_mode: 'HTML' });
            } catch (e) {
                // Fallback to plain text
                await ctx.reply(`${review.title}\n${stars(review.rating)}\n${review.author} · ${review.countryName}\n\n${review.content}`);
            }
            await new Promise(r => setTimeout(r, 300));
        }

        await ctx.reply(`Готово! ${reviews.length} отзывов из ${COUNTRY_CODES.length} стран.`);
    } catch (err) {
        console.error('Error in /reviews:', err.message);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
});

bot.command('status', async (ctx) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);

    await ctx.reply(
        `📊 Статус бота\n\n` +
        `Аптайм: ${hours}ч ${mins}м\n` +
        `Отзывов в базе: ${seenReviewIds.size}\n` +
        `Стран: ${COUNTRY_CODES.length}\n` +
        `Последний эпизод: ${lastEpisodeGuid ? 'отслеживается' : 'не установлен'}\n` +
        `Уведомления в: ${NOTIFY_CHAT_ID || 'не настроено'}\n` +
        `Готов: ${botReady ? 'да' : 'инициализация...'}`
    );
});

// --- Admin commands ---

bot.command('check', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('Нет доступа.');
    await ctx.reply('Проверяю новые отзывы...');
    await checkForNewReviews();
    await ctx.reply('Проверка завершена.');
});

bot.command('check_episodes', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('Нет доступа.');
    await ctx.reply('Проверяю новые эпизоды...');
    await checkForNewEpisodes();
    await ctx.reply('Проверка завершена.');
});

bot.command('set_notify', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('Нет доступа.');
    // This sets the current chat as notification target (in-memory only)
    // For persistence, set NOTIFY_CHAT_ID env var on Railway
    const chatId = ctx.chat.id;
    process.env.NOTIFY_CHAT_ID = String(chatId);
    await ctx.reply(`Уведомления будут приходить в этот чат (${chatId}).\n\nДля постоянной настройки установите NOTIFY_CHAT_ID=${chatId} в переменных окружения Railway.`);
});

// Don't reply to random text
bot.on('text', () => {});

// --- Error handling ---

bot.catch((err, ctx) => {
    console.error('Bot error:', err.message);
    try {
        ctx.reply('Произошла ошибка.');
    } catch (_) {}
});

// --- Startup ---

// Start HTTP server IMMEDIATELY so Railway healthcheck passes
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: botReady ? 'ok' : 'starting',
        reviews_tracked: seenReviewIds.size,
        uptime: Math.floor(process.uptime()),
    }));
});
server.listen(PORT, () => console.log(`Health check on port ${PORT}`));

let reviewInterval, episodeInterval;

async function start() {
    console.log('Starting bot...');

    // Initialize baselines (fetch current state without notifying)
    await Promise.all([
        initializeReviewBaseline(),
        initializeEpisodeBaseline(),
    ]);

    // Launch Telegram polling
    console.log('Launching Telegram bot...');
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch (_) {}

    // bot.launch() starts polling in background — it doesn't resolve
    bot.launch({ dropPendingUpdates: true })
        .catch(err => console.error('Bot polling error:', err.message));

    // Verify bot works by calling getMe
    try {
        const me = await bot.telegram.getMe();
        botReady = true;
        console.log(`Bot launched: @${me.username}`);
    } catch (err) {
        console.error('Bot getMe failed:', err.message);
        console.log('Bot may still start — polling runs in background');
        botReady = true; // Allow monitoring to work regardless
    }

    // Set up commands menu
    await bot.telegram.setMyCommands([
        { command: 'reviews', description: 'Последние отзывы из Apple Podcasts' },
        { command: 'status', description: 'Статус бота' },
        { command: 'help', description: 'Справка' },
    ]);

    // Schedule periodic checks
    reviewInterval = setInterval(checkForNewReviews, 60 * 60 * 1000); // every hour
    episodeInterval = setInterval(checkForNewEpisodes, 10 * 60 * 1000); // every 10 min

    console.log('Monitoring active: reviews every 60min, episodes every 10min');
}

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    if (reviewInterval) clearInterval(reviewInterval);
    if (episodeInterval) clearInterval(episodeInterval);
    server.close();
    bot.stop(signal);
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

start().catch(err => {
    console.error('Startup error:', err.message);
    console.log('Bot will retry on next deploy. Health check server remains active.');
});
