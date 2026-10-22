export type MysqlConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  charset: "utf8mb4";
  timezone: "+09:00";
};

type MysqlEnvironment = Record<string, string | undefined>;

export function mysqlConnectionConfigured(environment: MysqlEnvironment = process.env) {
  return Boolean(environment.MYSQL_HOST && environment.MYSQL_DATABASE && environment.MYSQL_USER);
}

export function mysqlConnectionConfig(
  environment: MysqlEnvironment = process.env,
): MysqlConnectionConfig {
  const missing = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER"].filter(
    (name) => !environment[name],
  );
  if (missing.length) throw new Error(`MySQL接続設定が不足しています: ${missing.join("、")}`);

  const port = Number(environment.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("MYSQL_PORTには1から65535の整数を設定してください。");

  return {
    host: environment.MYSQL_HOST!,
    port,
    database: environment.MYSQL_DATABASE!,
    user: environment.MYSQL_USER!,
    password: environment.MYSQL_PASSWORD || "",
    charset: "utf8mb4",
    timezone: "+09:00",
  };
}
