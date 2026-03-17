import path from 'path';
import winston from 'winston';

const { combine, errors, colorize, printf, timestamp } = winston.format;

// Derive a short name for the current entry point file (e.g. "sequentialAgents").
const entryPoint =
  (process.argv[1] && path.basename(process.argv[1], path.extname(process.argv[1]))) ||
  'app';

const isDebugMode = process.execArgv.some((arg) =>
  arg.includes('--inspect') || arg.includes('--debug'),
);

function formatArg(arg: unknown): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
  return String(arg);
}

const devFormat = printf(({ level, message, stack, timestamp: ts }) => {
  const header = ts ? `${ts} ${level}: ${message}` : `${level}: ${message}`;

  return stack ? `${header}\n${stack}` : header;
});

const winstonLogger = winston.createLogger({
  level: 'debug',
  format: combine(
    timestamp({
      format: () => new Date().toLocaleString(),
    }),
    errors({ stack: true }),
    colorize(),
    devFormat,
  ),
  transports: [
    // All levels written to a single file prefixed with the entry point name.
    new winston.transports.File({
      filename: `logs/${entryPoint}.log`,
      level: 'debug',
      // Append forever; do not truncate between runs.
      options: { flags: 'a' },
    }),
  ],
});

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isDebugMode) return;
    winstonLogger.debug(args.map(formatArg).join(' '));
  },
  info: (...args: unknown[]) => {
    winstonLogger.info(args.map(formatArg).join(' '));
  },
  warn: (...args: unknown[]) => {
    winstonLogger.warn(args.map(formatArg).join(' '));
  },
  error: (...args: unknown[]) => {
    winstonLogger.error(args.map(formatArg).join(' '));
  },
};
