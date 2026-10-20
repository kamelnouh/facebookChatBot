const fs = require("fs-extra");
const path = require("path");

const langDir = path.join(__dirname, "languages");
fs.ensureDirSync(langDir);

const defaultEn = {
  "system.started": "𝑲𝑨𝑴𝑬𝑳 𝑩𝑶𝑼𝑴𝑹𝑫𝑨𝑺𝑺𝑰 🪻💤 راه متصل ويستقبل الرسائل!",
  "system.loginFailed": "فشل تسجيل الدخول: %1",
  "command.notFound": "الأمر %1 غير موجود!",
  "command.noPermission": "⛔ ما عندكش الصلاحية لاستعمال هذا الأمر.",
  "command.error": "وقع خطأ أثناء تنفيذ الأمر: %1"
};

const enPath = path.join(langDir, "en.json");

if (!fs.existsSync(enPath)) {
  fs.writeJsonSync(enPath, defaultEn, { spaces: 2 });
}

class LanguageManager {
  constructor(defaultLang = "en") {
    this.defaultLang = defaultLang;
    this.languages = {};
    this.loadLanguages();
  }

  loadLanguages() {
    const files = fs.readdirSync(langDir).filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const langName = path.basename(file, ".json");

      try {
        this.languages[langName] = fs.readJsonSync(
          path.join(langDir, file)
        );
      } catch (e) {
        console.error(
          `فشل تحميل ملف اللغة ${file}:`,
          e.message
        );
      }
    });
  }

  getText(langKey, ...args) {
    const langObj =
      this.languages[this.defaultLang] ||
      this.languages["en"] ||
      {};

    let text = langObj[langKey] || langKey;

    args.forEach((arg, index) => {
      text = text.replace(
        new RegExp(`%${index + 1}`, "g"),
        String(arg)
      );
    });

    return text;
  }
}

module.exports = new LanguageManager();