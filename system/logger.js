const chalk = require("chalk");
const moment = require("moment-timezone");

function getTime() {
  return moment().tz("Africa/Algiers").format("YYYY-MM-DD HH:mm:ss");
}

const logger = {
  info: (msg) => {
    console.log(chalk.cyan(`[ ${getTime()} ][ INFO ]`) + ` ${msg}`);
  },
  success: (msg) => {
    console.log(chalk.green(`[ ${getTime()} ][ SUCCESS ]`) + ` ${msg}`);
  },
  warn: (msg) => {
    console.log(chalk.yellow(`[ ${getTime()} ][ WARN ]`) + ` ${msg}`);
  },
  error: (msg) => {
    console.log(chalk.red(`[ ${getTime()} ][ ERROR ]`) + ` ${msg}`);
  },
  cmd: (msg) => {
    console.log(chalk.magenta(`[ ${getTime()} ][ COMMAND ]`) + ` ${msg}`);
  },
  event: (msg) => {
    console.log(chalk.blue(`[ ${getTime()} ][ EVENT ]`) + ` ${msg}`);
  },
  

  banner: () => {
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════╗
║                                              ║
║                 KL BORRX                     ║
║                                              ║
║  𝑲𝑨𝑴𝑬𝑳 𝑩𝑶𝑼𝑴𝑹𝑫𝑨𝑺𝑺𝑰 🪻💤            ║
║                                              ║
╚══════════════════════════════════════════════╝
`));
  }
};⅚ř

module.exports = logger;
