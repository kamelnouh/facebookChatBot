const fs = require("fs");
const path = require("path");
const logger = require("./system/logger");
const db = require("./system/database");
const memory = require("./system/memory");
const FCAEngine = require("./system/fcaEngine");
const startWebServer = require("./system/webServer");

// Load Configuration
let config = {
  botName: "𝑲𝑨𝑴𝑬𝑳 𝑩𝑶𝑼𝑴𝑹𝑫𝑨𝑺𝑺𝑰 🪻💤",
  prefix: "!",
  adminUIDs: ["61593976169222"],
  port: 3000,
  options: {
    listenEvents: true,
    selfListen: false
  }
};

const configPath = path.join(__dirname, "config.json");

if (fs.existsSync(configPath)) {
  try {
    config = {
      ...config,
      ...JSON.parse(fs.readFileSync(configPath, "utf8"))
    };
  } catch (e) {
    logger.warn("تعذر قراءة config.json، سيتم استعمال الإعدادات الافتراضية.");
  }
}

// Ensure the configured bot admin UID is the only privileged admin.
config.adminUIDs = ["61593976169222"];

const language = require("./system/language");

// Global Bot Core Architecture Object
global.GoatBot = {
  commands: new Map(),
  events: new Map(),
  onReply: new Map(),
  config: config,
  language: language
};

// Dynamically Load Commands from /scripts/cmds
function loadCommands() {
  const cmdsPath = path.join(__dirname, "scripts", "cmds");

  if (!fs.existsSync(cmdsPath)) {
    fs.mkdirSync(cmdsPath, { recursive: true });
  }

  const files = fs.readdirSync(cmdsPath).filter((f) => f.endsWith(".js"));
  let loadedCount = 0;

  files.forEach((file) => {
    try {
      const fullPath = path.join(cmdsPath, file);
      delete require.cache[require.resolve(fullPath)];

      const cmd = require(fullPath);

      if (cmd.config && cmd.config.name) {
        global.GoatBot.commands.set(cmd.config.name.toLowerCase(), cmd);
        logger.success(`تم تحميل الأمر: ${cmd.config.name}`);
        loadedCount++;
      }
    } catch (err) {
      logger.error(`فشل تحميل الأمر ${file}: ${err.message}`);
    }
  });

  logger.info(`عدد الأوامر المحمّلة: ${loadedCount}`);
}

// Dynamically Load Events from /scripts/events
function loadEvents() {
  const eventsPath = path.join(__dirname, "scripts", "events");

  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
  }

  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));
  let loadedCount = 0;

  files.forEach((file) => {
    try {
      const fullPath = path.join(eventsPath, file);
      delete require.cache[require.resolve(fullPath)];

      const evt = require(fullPath);

      if (evt.config && evt.config.name) {
        global.GoatBot.events.set(evt.config.name.toLowerCase(), evt);
        logger.success(`تم تحميل الحدث: ${evt.config.name}`);
        loadedCount++;
      }
    } catch (err) {
      logger.error(`فشل تحميل الحدث ${file}: ${err.message}`);
    }
  });

  logger.info(`عدد الأحداث المحمّلة: ${loadedCount}`);
}

// Main Messenger MQTT & Hook Event Dispatcher
function setupMQTTListener(fcaEngine, api) {
  if (!api || typeof api.listenMqtt !== "function") return;

  api.listenMqtt(async (err, event) => {
    if (err) {
      logger.error(`خطأ في مستمع MQTT: ${err.message || err}`);
      return;
    }

    if (!event) return;

    // Message helper
    const messageHelper = {
      reply: (text, callback) =>
        fcaEngine.safeSendMessage(text, event.threadID, event.messageID),

      send: (text, callback) =>
        fcaEngine.safeSendMessage(text, event.threadID),

      unsend: (messageID) =>
        fcaEngine.unsendMessage(messageID)
    };

    // 1. Execute registered event modules
    for (const [eventName, evtModule] of global.GoatBot.events.entries()) {
      try {
        if (typeof evtModule.onEvent === "function") {
          await evtModule.onEvent({
            api,
            event,
            message: messageHelper,
            db,
            memory,
            logger,
            fcaEngine
          });
        }
      } catch (evtErr) {
        logger.error(`خطأ في الحدث [${eventName}]: ${evtErr.message}`);
      }
    }

    // 2. Handle onReply callbacks
    if (event.type === "message_reply" && event.messageReply) {
      const replyData = global.GoatBot.onReply.get(
        event.messageReply.messageID
      );

      if (replyData && replyData.commandName) {
        const command = global.GoatBot.commands.get(replyData.commandName);

        if (command && typeof command.onReply === "function") {
          try {
            await command.onReply({
              api,
              event,
              message: messageHelper,
              replyData,
              db,
              memory,
              logger,
              fcaEngine
            });
          } catch (rErr) {
            logger.error(
              `خطأ في الرد على الأمر [${replyData.commandName}]: ${rErr.message}`
            );
          }
        }
      }
    }

    // 3. Execute onChat hooks
    for (const [cmdName, cmdModule] of global.GoatBot.commands.entries()) {
      if (typeof cmdModule.onChat === "function") {
        try {
          await cmdModule.onChat({
            api,
            event,
            message: messageHelper,
            db,
            memory,
            logger,
            fcaEngine
          });
        } catch (chatErr) {
          logger.error(`خطأ في onChat [${cmdName}]: ${chatErr.message}`);
        }
      }
    }

    // 4. Process Prefixed Commands
    if (
      (event.type === "message" || event.type === "message_reply") &&
      event.body
    ) {
      try {
        const threadPrefix = db.getThreadPrefix(
          event.threadID,
          global.GoatBot.config.prefix
        );

        const bodyText = event.body.trim();

        if (!bodyText.startsWith(threadPrefix)) return;

        const args = bodyText
          .slice(threadPrefix.length)
          .trim()
          .split(/ +/);

        const commandName = args.shift().toLowerCase();
        const command = global.GoatBot.commands.get(commandName);

        if (!command) return;

        // Only the configured UID is a bot admin.
        const isBotAdmin =
          String(event.senderID) === "61593976169222";

        const roleRequired = command.config.role || 0;

        if (roleRequired === 2 && !isBotAdmin) {
          return messageHelper.reply(
            "⛔ هذا الأمر مخصص لمسؤول البوت فقط."
          );
        }

        logger.cmd(
          `[ المجموعة ${event.threadID} ][ المستخدم ${event.senderID} ] الأمر: ${threadPrefix}${commandName}`
        );

        // Run command onStart hook
        if (typeof command.onStart === "function") {
          await command.onStart({
            api,
            event,
            args,
            message: messageHelper,
            db,
            memory,
            logger,
            fcaEngine,
            role: isBotAdmin ? 2 : 0
          });
        }
      } catch (execErr) {
        logger.error(
          `خطأ في تنفيذ الأمر: ${execErr.stack || execErr.message}`
        );

        messageHelper.reply(
          `❌ وقع خطأ أثناء تنفيذ الأمر: ${execErr.message}`
        );
      }
    }
  });
}

// Main Master Launcher
async function startBot() {
  logger.banner();

  // 1. Start Keep-Alive Web Server Dashboard
  startWebServer(config.port || 3000);

  // 2. Dynamically Load Modules
  loadCommands();
  loadEvents();

  // 3. Initialize FCA Engine
  // Login mechanism and appState.json remain unchanged.
  const fcaEngine = new FCAEngine("appState.json");

  try {
    const api = await fcaEngine.init();

    if (api) {
      logger.success(
        "🚀 𝑲𝑨𝑴𝑬𝑳 𝑩𝑶𝑼𝑴𝑹𝑫𝑨𝑺𝑺𝑰 🪻💤 راه خدام ومتصل!"
      );

      setupMQTTListener(fcaEngine, api);
    }
  } catch (loginErr) {
    logger.error(`فشل تشغيل البوت: ${loginErr.message}`);
  }
}

// Global Exception Shields
process.on("uncaughtException", (err) => {
  logger.error(`خطأ غير معالج: ${err.message}`);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`رفض Promise غير معالج: ${reason}`);
});

// Launch
startBot();