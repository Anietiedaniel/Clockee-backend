import winston from "winston";
import fs from "fs";
import path from "path";

export const createLogger = (serviceName = "default-service") => {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${serviceName}] ${level.toUpperCase()}: ${message}`;
        })
      ),
    }),
  ];

  if (process.env.NODE_ENV === "development") {
    const logDir = "logs";
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}.log`),
      })
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    transports,
  });
};
