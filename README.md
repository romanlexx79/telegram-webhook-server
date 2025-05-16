# Telegram Webhook Server

Jednoduchý Express server pro zpracování webhook požadavků od Telegram bota.

## Funkce

- Přijímá webhook požadavky od Telegram bota
- Zpracovává příkazy ve formátu `/reply ID_KONVERZACE Vaše odpověď`
- Ukládá odpovědi operátora do databáze
- Odesílá potvrzení o přijetí zprávy

## Instalace

1. Naklonujte repozitář
2. Nainstalujte závislosti: `npm install`
3. Vytvořte soubor `.env` s následujícími proměnnými:
   - `DATABASE_URL` - připojovací řetězec k PostgreSQL databázi
   - `TELEGRAM_BOT_TOKEN` - token vašeho Telegram bota
   - `PORT` - port, na kterém bude server běžet (výchozí: 3000)
4. Spusťte server: `npm start`

## Nasazení na Railway

1. Vytvořte nový projekt na Railway
2. Propojte projekt s GitHub repozitářem
3. Nastavte proměnné prostředí:
   - `DATABASE_URL` - připojovací řetězec k PostgreSQL databázi
   - `TELEGRAM_BOT_TOKEN` - token vašeho Telegram bota
4. Nasaďte aplikaci

## Nastavení Telegram Webhook

Po nasazení serveru na Railway nastavte webhook pro vašeho Telegram bota:

```
curl -X POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<RAILWAY_URL>/webhook
```

Nahraďte `<TELEGRAM_BOT_TOKEN>` vaším Telegram bot tokenem a `<RAILWAY_URL>` URL adresou vaší aplikace na Railway.

## Použití

Odešlete zprávu ve formátu `/reply ID_KONVERZACE Vaše odpověď` vašemu Telegram botovi. Server zpracuje zprávu a uloží ji do databáze jako odpověď operátora.
