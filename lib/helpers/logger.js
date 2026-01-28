import winston from 'winston'
import 'winston-daily-rotate-file'
import utils from './utils.js'

const logger = winston.createLogger({
  level: utils.config('loglvl', 'info'),
  defaultMeta: { mainLabel: 'MAIN' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ message, timestamp, level, mainLabel, childLabel }) => {
      return `${timestamp} [${childLabel || mainLabel}][${level}] -> ${message}`
    })
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'app-%DATE%.log',
      dirname: utils.rootdir() + '/datas/applogs',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '5m',
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      filename: 'error-%DATE%.log',
      dirname: utils.rootdir() + '/datas/applogs',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '5m',
      zippedArchive: true,
    }),
  ],
})

// eslint-disable-next-line no-undef
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.cli(),
        winston.format.align(),
        winston.format.printf(({ message, timestamp, level, mainLabel, childLabel }) => {
          return `${timestamp} [${childLabel || mainLabel}][${level}] -> ${message}`
        })
      ),
    })
  )
}

export default logger
