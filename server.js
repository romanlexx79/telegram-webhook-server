// Jednoduchý Express server pro Telegram webhook
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// Vytvoření Express aplikace
const app = express();
app.use(bodyParser.json());

// Vytvoření připojení k databázi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SnGSAvBbQFekzWNyormnYPsYABOHsFRe@hopper.proxy.rlwy.net:29028/railway'
});

// Telegram bot token
const botToken = process.env.TELEGRAM_BOT_TOKEN || '7952067034:AAHZGo7ADxZLAM7GxAgDKn5d8oZha1FCfOU';

// Funkce pro odeslání zprávy přes Telegram API
async function sendTelegramMessage(chatId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    console.log('Telegram API odpověď:', data);
    return data;
  } catch (error) {
    console.error('Chyba při odesílání zprávy přes Telegram API:', error);
    throw error;
  }
}

// Endpoint pro Telegram webhook
app.post('/webhook', async (req, res) => {
  try {
    console.log('Přijat webhook požadavek od Telegramu:', JSON.stringify(req.body));

    // Kontrola, zda požadavek obsahuje zprávu
    if (!req.body || !req.body.message || !req.body.message.text) {
      console.log('Požadavek neobsahuje zprávu');
      return res.status(200).json({ success: true });
    }

    const message = req.body.message;
    const chatId = message.chat.id;
    const text = message.text;

    console.log('Přijata zpráva:', text);
    console.log('Od chat ID:', chatId);

    // Kontrola, zda zpráva začíná příkazem /reply
    if (!text.startsWith('/reply')) {
      console.log('Zpráva nezačíná příkazem /reply');
      
      // Odeslání nápovědy
      const helpMessage = `
<b>Neplatný formát příkazu</b>

Správný formát je:
/reply ID_KONVERZACE Vaše odpověď

Například:
/reply 4dbc51b7-4de8-420c-b414-d6121dda693b Dobrý den, děkuji za Vaši zprávu. Jak Vám mohu pomoci?
`;
      
      await sendTelegramMessage(chatId, helpMessage);
      
      return res.status(200).json({ success: true });
    }

    // Extrakce ID konverzace a obsahu zprávy
    const commandText = text.substring(7).trim(); // Odstranění "/reply "
    const firstSpaceIndex = commandText.indexOf(' ');

    if (firstSpaceIndex === -1) {
      console.log('Chybí obsah zprávy');
      
      // Odeslání chybové zprávy
      const errorMessage = `
<b>Chyba: Chybí obsah zprávy</b>

Správný formát je:
/reply ID_KONVERZACE Vaše odpověď

Například:
/reply 4dbc51b7-4de8-420c-b414-d6121dda693b Dobrý den, děkuji za Vaši zprávu. Jak Vám mohu pomoci?
`;
      
      await sendTelegramMessage(chatId, errorMessage);
      
      return res.status(200).json({ success: true });
    }

    // Získání ID konverzace a obsahu zprávy
    const conversationId = commandText.substring(0, firstSpaceIndex);
    const messageContent = commandText.substring(firstSpaceIndex + 1);

    console.log('ID konverzace:', conversationId);
    console.log('Obsah zprávy:', messageContent);

    // Kontrola, zda ID konverzace je ve správném formátu UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(conversationId)) {
      console.log('ID konverzace není ve správném formátu UUID:', conversationId);
      
      // Odeslání chybové zprávy
      const errorMessage = `
<b>Chyba: Neplatný formát ID konverzace</b>

ID konverzace musí být ve formátu UUID, například:
4dbc51b7-4de8-420c-b414-d6121dda693b

Vaše zadané ID: ${conversationId}
`;
      
      await sendTelegramMessage(chatId, errorMessage);
      
      return res.status(200).json({ success: true });
    }

    // Kontrola, zda konverzace existuje
    const client = await pool.connect();
    
    try {
      const conversationResult = await client.query(
        'SELECT c.id, c.visitor_id, c.chatbot_id, cb.user_id, cb.name FROM conversations c JOIN chatbots cb ON c.chatbot_id = cb.id WHERE c.id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        console.log('Konverzace nebyla nalezena');
        
        // Odeslání chybové zprávy
        const errorMessage = `
<b>Chyba: Konverzace nebyla nalezena</b>

ID konverzace: ${conversationId}

Zkontrolujte, zda jste zadali správné ID konverzace.
`;
        
        await sendTelegramMessage(chatId, errorMessage);
        
        return res.status(200).json({ success: true });
      }

      const conversation = conversationResult.rows[0];
      console.log('Nalezena konverzace:', conversation);

      // Kontrola, zda uživatel má oprávnění odpovídat na tuto konverzaci
      const settingsResult = await client.query(
        'SELECT telegram_bot_token, telegram_chat_id, telegram_notifications, telegram_live_operator FROM reservation_settings WHERE user_id = $1',
        [conversation.user_id]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].telegram_chat_id || settingsResult.rows[0].telegram_chat_id !== chatId.toString()) {
        console.log('Uživatel nemá oprávnění odpovídat na tuto konverzaci');
        
        // Odeslání chybové zprávy
        const errorMessage = `
<b>Chyba: Nemáte oprávnění odpovídat na tuto konverzaci</b>

ID konverzace: ${conversationId}
`;
        
        await sendTelegramMessage(chatId, errorMessage);
        
        return res.status(200).json({ success: true });
      }

      // Vytvoření zprávy
      const messageId = uuidv4();
      const now = new Date().toISOString();

      // Nejprve zkontrolujeme, zda již neexistuje zpráva se stejným obsahem
      const existingResult = await client.query(
        `SELECT id, content, created_at
         FROM live_operator_messages
         WHERE conversation_id = $1 AND role = 'operator' AND content = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [conversationId, messageContent]
      );

      if (existingResult.rows.length > 0) {
        console.log('Zpráva se stejným obsahem již existuje:', existingResult.rows[0]);
        
        // Odeslání potvrzení
        const confirmationMessage = `
<b>Zpráva již byla odeslána</b>

ID konverzace: ${conversationId}
Čas odeslání: ${new Date(existingResult.rows[0].created_at).toLocaleString()}
`;
        
        await sendTelegramMessage(chatId, confirmationMessage);
        
        return res.status(200).json({ success: true });
      }

      // Zpráva neexistuje, vytvoříme novou
      const insertResult = await client.query(
        `INSERT INTO live_operator_messages (
          id, conversation_id, visitor_id, content, role, is_read, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'operator', false, NOW(), NOW()
        ) RETURNING id, content, role, created_at`,
        [
          messageId,
          conversationId,
          conversation.visitor_id,
          messageContent
        ]
      );

      console.log('Zpráva uložena:', messageId);
      console.log('Výsledek vložení:', insertResult.rows[0]);

      // Odeslání potvrzení
      const confirmationMessage = `
<b>Odpověď byla úspěšně odeslána</b>

ID konverzace: ${conversationId}
`;
      
      await sendTelegramMessage(chatId, confirmationMessage);
      
      return res.status(200).json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Chyba při zpracování webhook požadavku:', error);
    return res.status(500).json({ error: 'Chyba při zpracování webhook požadavku' });
  }
});

// Endpoint pro kontrolu stavu serveru
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Telegram webhook server je aktivní' });
});

// Spuštění serveru
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});
